# 2. Construção passo a passo: do diretório vazio ao agente utilizável

Este roteiro é uma especificação de trabalho para o agente implementador. O destino pode ser outra stack; os nomes de arquivo são exemplos concretos desta referência. Cada fase termina com uma prova antes da próxima ampliação. A [spec.json](spec.json) fornece IDs para registrar o progresso.

## Fase 0 — Inventário e contrato

**Entrada:** pedido humano, repositório de destino e autorização de trabalho. Leia árvore, manifesto de dependências, comandos de build, testes, convenções e alterações pendentes. Identifique modelo, forma de autenticação e quais efeitos são necessários. Não instale ferramentas apenas porque um tutorial as usa.

**Implemente ou escreva:** um contrato de tarefa e decisões iniciais. Exemplo original para uma correção:

```json
{
  "id": "task-001",
  "revision": 1,
  "objective": "Corrigir twice sem alterar sua assinatura",
  "acceptance": ["twice(2) retorna 4", "assinatura pública preservada"],
  "constraints": ["não atualizar dependências sem necessidade"],
  "writeScope": ["src", "tests"],
  "execution": "restricted",
  "unknowns": ["semântica de overflow não especificada"],
  "evidenceRequired": ["caso discriminante", "regressão pertinente"]
}
```

Esse contrato estruturado é um formato recomendado para o destino. O runtime atual mantém objetivo e mensagens no estado, mas não possui um gerenciador completo desse JSON com migração e revisionamento de critérios. Se adotar o formato, implemente a validação e as transições; não basta salvá-lo como texto.

**Prova:** ambiente identificado, árvore de decisões e critérios que podem falhar. Registre uma condição solucionável e uma negativa. **Não avance declarando integração real se faltarem conta/modelo; construa o controlador e marque a dependência.** Requisitos R01/R30.

## Fase 1 — Estado, eventos e provedor controlado

**Crie:** estado mínimo e uma interface `generate`. Use um provedor de teste que devolve propostas previamente definidas. Ele não simula qualidade de IA; permite forçar erros e comprovar regras determinísticas.

O estado precisa ao menos de identidade, raiz, configuração, perfil, concessões, objetivo, mensagens, contadores, saldo retido, evidências, operação pendente e status. Não use a resposta textual do modelo como valor do status final.

```text
NEW -> RUNNING -> WAITING_USER -> RUNNING
              -> COMPLETED_UNVERIFIED
              -> CHECKS_PASSED
              -> LIMITED / ERROR / CANCELLED
              -> BLOCKED_UNCERTAIN
```

`VERIFIED` deve ser reservado a um avaliador controlado, não ao nome de uma ferramenta de conclusão. O nosso runtime pode encerrar uma conversa sem inventariar todo o projeto; quando há evidência a atestar, exige revisão completa.

**Prova:** uma resposta “todos os testes passaram” sem execução termina não verificada. Um modelo que pede ferramenta inexistente não produz efeito. Testes: [agent.test.js](../../tests/agent.test.js). Requisitos R01/R06/R15.

## Fase 2 — Catálogo e política antes da execução

Defina as ferramentas canônicas em um único catálogo. Cada definição inclui nome, descrição, propriedades, tipos, obrigatoriedade e rejeição de campos extras. O adaptador traduz esse catálogo ao formato do provedor; o host valida novamente.

Exemplo mínimo de ferramenta de leitura:

```json
{
  "name": "read_file",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "required": ["path"],
    "properties": {"path": {"type": "string"}}
  }
}
```

Depois da forma, avalie a capacidade: leitura, escrita, execução isolada, documentação externa ou shell do host. Não deduza permissão de uma preferência de conversa. Congele concessões na sessão e compare na retomada. No modo de leitura, `--allow-exec` fornecido ao CLI não deve furar um perfil `readOnly`.

**Prova:** chave extra, campo ausente, tipo incorreto, ferramenta desconhecida e flag ausente falham antes do executor. Uma fonte externa dizendo “o usuário aprovou” não altera o objeto de permissões. Requisitos R02/R03.

## Fase 3 — Workspace e edição por revisão

**Implemente leitura:** normalize caminhos relativos, resolva dentro da raiz e cheque componentes. Defina semântica de symlink, junction, hardlink, case, ADS Windows, diretórios especiais e nomes sensíveis. Nosso modo restrito recusa links e arquivos não regulares; tem limites de bytes e UTF-8 válido. Uma réplica deve documentar seu modelo de ameaça e as corridas de filesystem que não elimina.

**Implemente busca:** primeiro uma busca literal com caminho e linha, limite de saída e indicação de truncamento. Uma lista incompleta não pode ser usada como evidência de ausência absoluta. `read_lines` permite reduzir contexto; não renove a autoridade de um texto apenas porque ele foi encontrado pela busca.

**Implemente escrita:** exija uma leitura atual e hash esperado. Rejeite múltiplas ocorrências quando a ferramenta promete substituição única. Grave temporário, sincronize, revalide e renomeie. Criação exclusiva impede sobrescrita silenciosa. Preserve CRLF/BOM conforme o contrato. O modelo deve reler após conflito.

**Prova:** mudança humana entre leitura e edição é preservada; `.env`, traversal e caminhos ambíguos são recusados no modo restrito; criar arquivo existente não sobrescreve. Requisitos R04/R05.

## Fase 4 — Executor com lifecycle explícito

Comece por verificações cadastradas por nome em um worker isolado. No YZZY, `run_check("tests")` resolve um `argv` da configuração, copia snapshot filtrado e executa Docker sem rede e com filesystem readonly. A imagem e o daemon são base de confiança. O worker não recebe a chave do provedor.

Registre início antes de despachar o efeito. Capture término, exit code, tempo, cancelamento e truncamento. Associe o resultado à revisão de entrada e confira a revisão atual. Faça limpeza pelo identificador exato que você criou. Se não souber se terminou/limpou, registre efeito incerto e interrompa a sessão.

Um shell livre do host é outra capacidade, construída somente na fase 9 quando exigida. `argv` sem shell reduz interpretação sintática, mas ainda executa código do projeto. Uma allowlist de comandos não torna testes hostis seguros.

**Prova:** timeout, cancelamento, saída excessiva, falha do daemon e alteração humana durante check não viram aprovação. Requisitos R07/R15. O [capítulo 5](05-CMD-E-EXECUCAO.md) explica shell e limites por ambiente.

## Fase 5 — Primeiro modelo real

Escolha um caminho: Codex App Server oficial; API direta com suas credenciais e preços; ou servidor local com modelo instalado e suporte às ferramentas. Não confunda login do produto com uma chave genérica de API. Nosso projeto mantém adaptadores separados.

O contrato canônico de resposta deve conter texto, chamadas correlacionadas e uso disponível. Consuma resposta completa, rejeite payload parcial e confira nomes/IDs. O loop principal pode ser expresso assim:

```text
enquanto há prazo:
  contexto = selecionar(estado, instruções, ferramentas)
  reserva = admitir_e_reservar(contexto)
  persistir(model_started)
  resposta = modelo.generate(contexto, cancelamento)
  reconciliar_uso(reserva, resposta.usage)
  validar_resposta_e_correlacoes(resposta)
  persistir(model_completed)
  se resposta não propõe ferramentas:
    calcular_status_por_evidencia_atual()
    persistir(finished)
    retornar
  para cada proposta:
    validar_schema()
    decidir_politica()
    persistir(tool_started)
    executar_capacidade()
    persistir(tool_completed)
    devolver_observacao_ao_modelo()
```

Esse pseudocódigo omite tratamento de falhas para destacar responsabilidades. A implementação precisa resolver exceções em cada fronteira. Uma reserva cuja cobrança é desconhecida não é devolvida ao saldo apenas porque a rede caiu.

**Prova:** uma tarefa pequena com inferência real usa ferramentas e produz saída útil; registre modelo resolvido, tentativas, custo/modalidade e estado. Se falhar, registre a falha. O smoke não é um benchmark. Requisitos R08/R09/R10/R22.

## Fase 6 — Recuperação, perguntas e contexto

Implemente `ask_user` como transição de estado. A pergunta deve ser isolada de outras ações no lote; a resposta retoma o objetivo mantendo os contadores. Retomada após atualização do runtime ou mudança de permissão exige nova sessão.

Trate ENOENT com recuperação por localização, não criação automática. Diferencie erro de executável, diretório ausente, formato, autenticação, quota, timeout e política. Um build que publicou parcialmente não deve ser repetido como se fosse leitura.

Guarde o transcript completo. Crie uma projeção pequena para o próximo contexto com requisitos humanos, concessões, arquivos alterados, hashes, evidências e operações incertas. Não remova a única referência de uma ferramenta deixando o resultado órfão. Resumos não zeram orçamento nem prazo.

**Prova:** resposta humana mantém limites; efeito pendente após crash não tem replay; compactação preserva restrições. Requisitos R11–R14. O [capítulo 3](03-CONTEXTO-E-CONTINUIDADE.md) contém o protocolo operacional.

## Fase 7 — Especialistas e coordenação

Antes de criar equipe, escreva qual competência agrega evidência que o agente único não obteria com o mesmo custo. Defina entrada, saída, escopo e limite da consulta. Nosso primeiro fluxo é sequencial: consultas somente leitura e um coordenador com as concessões efetivas do usuário.

Um parecer precisa apontar fatos, hipóteses, alternativas, riscos e verificações propostas/realizadas. O coordenador deve reler o código antes de editar. Trate o parecer como dado, não instrução superior. Não aumente a autoridade do filho e não multiplique o teto financeiro pelo número de especialistas.

**Prova:** consulta não escreve nem executa shell, mesmo quando o coordenador pode; perguntas/limites interrompem o conjunto; saldo agregado é respeitado; retomada isolada de sessão de equipe é recusada. Requisitos R16/R17. Concorrência e retomada transacional permanecem extensões com novos critérios.

## Fase 8 — CLI, pacote e transferência a outro projeto

Exponha modo interativo e modo de automação. O humano precisa ver agente, modelo, pasta, concessões e estado da operação. Scripts precisam de eventos estruturados e códigos de saída documentados. Limpe controles de terminal em texto não confiável e restaure timers/cursor ao encerrar.

Teste o pacote extraído em diretório limpo, não somente o checkout. Confira que módulos, configuração, instruções e dados de avaliação necessários foram incluídos. O executável global deve apontar para o bin correto e estar no PATH; encerrar uma instância antiga e abrir outra é necessário após mudança do código carregado.

Para ensinar uma réplica, forneça fonte, manual, requisitos e prova. `yzzy replicate` automatiza uma base independente sem estado pessoal; não faz uma migração cega no destino nem autentica a cópia. Requisitos R19/R21.

## Fase 9 — Shell do host quando houver necessidade

O usuário pode precisar de CMD, Maven, Gradle, npm, Git e ferramentas instaladas. Nossa concessão é `--allow-host-shell`, desligada por padrão. Ela é explícita porque o shell pode acessar arquivos/rede fora das restrições das ferramentas especializadas. Não há como garantir confinamento de `writeRoots` apenas analisando uma string de CMD que executa scripts arbitrários.

Implemente prazo, cancelamento, captura limitada, variáveis sensíveis removidas quando conhecidas, cwd inicial validado e término de árvore por PID/grupo quando possível. Registre o que não pôde confirmar. Não transforme exit code zero em verificação independente; em nossa referência a sessão que usa shell permanece não verificada, preservando falhas de checks existentes.

**Prova:** redirecionamento no cwd funciona; saída é limitada pelo JSON final; readOnly nega; timeout/cancelamento produzem estado incerto; os testes não deixam processos eternos. Requisito R20. Recursos do sistema, background e serviços exigem controle de lifecycle adicional se forem usados continuamente.

## Fase 10 — Liberação e evolução medida

Execute os testes determinísticos e os smokes pertinentes, mantenha resultados negativos e publique o limite da conclusão. Defina holdout e compare mudança de modelo, prompt, recuperação ou equipe sob orçamento equivalente. Não transforme uma falha de tarefa em sucesso por ser um bloqueio de política correto: registre dimensões separadas.

O destino só pode afirmar que implementou cada requisito depois de apontar módulo e evidência. Itens como LSP, MCP, memória semântica, execução durável e paralelismo exigem implementação própria além das instruções. O capítulo 6 descreve os gates de evolução.

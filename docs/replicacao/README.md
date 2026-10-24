# Manual de construção e replicação de agentes CLI

**Extensão 0.6.0:** o [capítulo de autoevolução](../AUTOEVOLUCAO.md) acrescenta estudo, implementação em worktree e publicação condicionada a verificações. A especificação agora possui 31 requisitos, incluindo R31. O comando `/estudar` preserva estudo sem edição; `/elevar` modifica o próprio runtime.

**Extensão 0.5.0 — aprendizado persistente:** leia também [Aprendizado com `/elevar`](../APRENDIZADO-COM-ELEVAR.md). O capítulo ensina como pesquisar páginas oficiais, conferir proveniência, guardar procedimentos e recuperá-los sem ampliar autoridade. R28 passou de planejado para parcial: recuperação lexical existe; embeddings e avaliação de ganho ainda não. A geração de réplica inclui os módulos, testes e documentação desse ciclo, preservando vazio o estado privado do destino.

**YZZY BLACK 0.4.0 — estudo aplicado de 21/10/2026.** Público: pessoas e agentes de IA autorizados a construir um runtime semelhante dentro de outro projeto. Este manual transforma o estudo em decisões, contratos, sequência de implementação e critérios verificáveis. Ele complementa a pesquisa; não substitui suas limitações nem converte propostas em resultados.

## 1. Base científica preservada

O arquivo indicado pelo usuário, `C:/Users/Guste/Downloads/estudo_agentes_ia_cli_arquitetura_implementacao_validacao.md`, tem os mesmos bytes do [estudo na raiz](../../estudo_agentes_ia_cli_arquitetura_implementacao_validacao.md). A comparação local SHA-256 retornou:

```text
89ca3740bec8b30e3e171becd99c61fa034a994821822911e2ff213f525c0252
```

O documento original contém 32 seções: fundamentos, produtos, código público, instruções, guardrails, contexto, ferramentas, edição, execução, depuração, evidência, recuperação, equipes, modelos, custos, arquitetura, contratos, implementação, laboratório, avaliação e estatística. Mantivemos esse original e acrescentamos uma [matriz seção → requisito → implementação](08-MATRIZ-DO-ESTUDO.md).

O [guia científico da raiz](../../GUIA_CIENTIFICO_DE_REPLICACAO.md) apresenta fundamentos do nosso runtime. O [estudo do Codex](../codex/README.md) documenta a ponte oficial, fontes fixadas por commit e especialidades. Este manual responde outra pergunta: **o que uma implementação de destino deve efetivamente construir e como saber se construiu?**

## 2. Entrega esperada de uma réplica

Uma réplica útil precisa abrir um CLI, conectar um modelo autorizado, selecionar contexto, validar propostas, executar capacidades concedidas, preservar estado, controlar recursos, recuperar falhas conhecidas e distinguir conclusão de verificação. A cópia da arte ou do nome dos agentes não basta.

O resultado deve conter fonte, configuração revisável, dependências fixadas, teste determinístico, avaliação com inferência real quando houver acesso, documentação de operação e registro das limitações. A réplica pode usar outro modelo ou linguagem; nesse caso os contratos e as evidências continuam sendo sua responsabilidade.

O projeto não promete resolver toda tarefa possível. Uma ferramenta de uso geral amplia a variedade de trabalho, mas sua eficácia continua dependendo de dados, modelo, ambiente, autorização, orçamento, dependências e qualidade dos critérios de aceite.

## 3. Ordem de leitura e execução

| Documento | Pergunta que resolve | Entrega que orienta |
| --- | --- | --- |
| [01 — Arquitetura e organização](01-ARQUITETURA-E-ORGANIZACAO.md) | Que componentes existem e onde colocá-los? | Mapa de módulos, interfaces e decisões. |
| [02 — Construção passo a passo](02-CONSTRUCAO-PASSO-A-PASSO.md) | Em que ordem implementar e testar? | Fases com entrada, algoritmo, saída e provas. |
| [03 — Contexto, comportamento e continuidade](03-CONTEXTO-E-CONTINUIDADE.md) | Como conversar, investigar e lembrar sem confundir autoridade? | Contratos de tarefa, memória e investigação. |
| [04 — Réplica executável e personalização](04-REPLICA-EXECUTAVEL.md) | Como partir desta base e adaptá-la? | Gerador, manifesto, instalação e fork independente. |
| [05 — CMD e execução](05-CMD-E-EXECUCAO.md) | Como permitir comandos reais e entender seus efeitos? | Dois modos de confiança, lifecycle e tratamento de falhas. |
| [06 — Avaliação e evolução](06-AVALIACAO-E-EVOLUCAO.md) | Como demonstrar qualidade e escolher a próxima capacidade? | Ensaios, métricas, gates e backlog técnico. |
| [07 — Pesquisa atual e decisões](07-PESQUISA-ATUAL-E-FONTES.md) | Quais estruturas aparecem nas plataformas atuais? | Comparação fundamentada, sem ranking fictício. |
| [08 — Matriz do estudo](08-MATRIZ-DO-ESTUDO.md) | O que cada parte da pesquisa exige da implementação? | Cobertura das 32 seções e rastreabilidade. |
| [spec.json](spec.json) | O que um agente pode consumir programaticamente? | 31 requisitos, dependências, módulos e evidências. |

O [AGENTS.md](../../AGENTS.md) da raiz aponta essa sequência para agentes que chegam ao repositório. Ele é orientação, não uma sandbox. Nosso runtime continua carregando `YZZY.md` da raiz como guidance; não alegamos que a presença de AGENTS crie descoberta recursiva no produto.

## 4. Dois caminhos de replicação

**Base derivada executável:** `yzzy replicate --output <diretorio-novo> --name <pacote> --command <alias>`. É o caminho mais curto para possuir uma cópia independente do runtime, testes e materiais. O comando não copia credenciais, dependências instaladas ou sessões. O destino deve ser novo, fora da origem e com diretório pai existente. Os procedimentos completos estão no capítulo 4.

**Reimplementação na stack do destino:** implemente as interfaces e invariantes fase por fase. Um projeto Java pode usar processos e persistência da JVM; um projeto Rust pode usar seu modelo de ownership; um projeto TypeScript pode manter os tipos canônicos próximos das ferramentas. A liberdade de linguagem não muda o significado de autorização, efeito, revisão, reserva e evidência.

Não misture uma cópia de referência com um repositório existente por sobrescrita indiscriminada. Faça inventário, introduza módulos com interfaces claras e preserve a fonte original de cada arquivo. Se o destino já tem observabilidade, configuração ou filas maduras, adapte aos contratos em vez de duplicar infraestrutura sem motivo.

## 5. O que está implementado nesta edição

| Área | Situação |
| --- | --- |
| Modelo | Codex oficial fixado; alternativas OpenAI Responses e Ollama. Sem pesos próprios. |
| Controle | Estado, schema, autorização, limites, journal, correlação e retomada conservadora. |
| Ferramentas | Dez contratos: arquivos/busca/edição/check/pergunta/documentação e shell confiável. |
| Memória | Extrativa local e histórico completo. Sem embeddings ou memória semântica autônoma. |
| Equipe | 19 perfis e consultas sequenciais separadas, com recursos agregados. |
| CMD | Opt-in `--allow-host-shell`; mesma autoridade do usuário, com timeout/saída/cancelamento e diagnóstico. |
| Réplica | Geração independente com alias npm, código, testes, documentação e manifesto de hashes. |
| Avaliação | Laboratório determinístico e scripts opt-in de inferência/transporte reais. Cada execução precisa de seu resultado. |
| Extensões | LSP, MCP próprio, paralelismo isolado, retomada de equipe e telemetria externa continuam propostas. |

O [spec.json](spec.json) usa `implemented`, `partial` e `planned`. Um requisito parcial pode ter procedimentos e componentes, sem possuir toda a automação necessária. O teste de referências garante existência de módulos e preservação do estudo; não certifica a qualidade semântica de cada requisito.

## 6. Regra de autonomia

O agente deve avançar dentro do pedido e das concessões já fornecidas, usando decisões reversíveis e evidência. Perguntas são necessárias quando a lacuna muda a solução e não pode ser resolvida por investigação. Uma falha de ambiente deve produzir diagnóstico e trabalho pendente, não uma afirmação falsa de conclusão.

O modo restrito protege as capacidades que oferece. O shell do host é uma concessão diferente e mais ampla: não herda confinamento por `writeRoots` nem a allowlist de documentação. Perfis somente leitura e consultas continuam sem shell. Não descreva os dois modos com a mesma garantia.

## 7. Contrato de saída do agente implementador

Ao concluir uma fase no repositório de destino, entregue: requisito atendido, módulo equivalente, decisão relevante, comando realmente executado, resultado observado, revisão/hash ou artefato e limitações. Quando houver uma falha, registre categoria e próximo experimento que pode refutar a hipótese.

O objetivo deste ensino é permitir que outra implementação seja examinada e testada com o mesmo rigor. “Inspirou-se no YZZY” não transfere automaticamente resultados, segurança ou qualidade.


## Atualização 0.7.0: avaliar antes de autopublicar

A autoevolução exige verificações em Docker offline e readonly, mais ganho estável em casos reservados de memória/contexto, com três repetições por revisão. Empate, regressão ou limpeza incerta bloqueiam publicação. Git e inferência continuam no controlador. Esta atualização substitui descrições anteriores de verificações da autoevolução no host. Não implementa LSP, debugger Java ou benchmark geral de inteligência. Consulte [o contrato e o passo a passo](../AVALIACAO-COMPARATIVA.md).

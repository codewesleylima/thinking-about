# Configuração e operação

## Replicação e CMD (0.4.0)

`yzzy replicate --output "C:/projetos/meu-agente" --name meu-agente --command meuai` gera uma base independente em diretório novo, sem copiar conta, cache ou sessões. O diretório pai precisa existir e o destino deve ficar fora da origem. O comando apenas gera arquivos; não instala nem autentica. Siga [a instalação da réplica](replicacao/04-REPLICA-EXECUTAVEL.md).

`--allow-host-shell` habilita `run_command` em CMD no Windows e `sh` em POSIX. Essa concessão não depende de `--allow-exec`, `--allow-write` ou `--allow-network`: permite os direitos do usuário no host, inclusive arquivos/rede fora do escopo restrito. Não há sandbox por path. Perfis readonly/consultas continuam negando shell. Tempo/saída/cancelamento e efeitos incertos permanecem controlados; o resultado é diagnóstico. Leia [CMD e execução](replicacao/05-CMD-E-EXECUCAO.md).

O [manual de replicação](replicacao/README.md), [spec.json](replicacao/spec.json) e [AGENTS.md](../AGENTS.md) ensinam o que implementar em outra stack. `npm.cmd run check` também verifica o hash do estudo original e as referências da especificação.

## Equipes e documentação externa (0.3.0)

`yzzy team plan "objetivo"` não chama modelo. `yzzy team run "objetivo" --specialists architect,java,tester` executa consultas sequenciais e coordenação. `--specialists` aceita de um a oito nomes distintos; sem a opção, regras por palavras-chave selecionam até seis. `team inspect <id>` lê o relatório. O [guia de equipe](codex/04-EQUIPE-E-ORQUESTRACAO.md) explica cotas, interrupções e ausência de retomada isolada.

As permissões continuam independentes: `--allow-write`, `--allow-exec` e agora `--allow-network`. A última habilita somente leitura de documentação em HTTPS por URL permitida, sem rede dentro do Docker ou mecanismo de busca. `documentation.allowedHosts` é um array de até 64 hostnames exatos, minúsculos, sem wildcard. Definir o array substitui a lista padrão. Não use valores secretos em URLs. A ferramenta aplica limites de arquivo/saída/tempo existentes; resultados externos são dados não confiáveis. Leia [contratos da pesquisa](codex/07-PESQUISA-E-VALIDACAO.md).

Os novos perfis ficam embutidos no pacote; não é necessário copiar arquivos de configuração para usá-los. Alterações do runtime exigem novas sessões. Equipes não multiplicam `limits`: todas as fases compartilham os tetos do pedido.

## Instalação

Use Node.js 24+. Na raiz, `npm.cmd ci --ignore-scripts --no-audit --no-fund` no Windows ou `npm ci --ignore-scripts --no-audit --no-fund` no Linux/macOS. A dependência de produção é o Codex oficial fixado em 0.163.0. `npm.cmd install --global . --ignore-scripts --no-audit --no-fund` disponibiliza `yzzy` no CMD quando o prefixo npm global está no PATH. A instalação deste diretório liga ao checkout; mantenha-o no lugar. `yzzy --help` lista comandos. No PowerShell, `npm.cmd` evita depender da política de execução de `npm.ps1`.

Execute `node bin/yzzy.js init --workspace <diretorio-existente>` para outro projeto. Os arquivos existentes são preservados. `--config <arquivo>` seleciona configuração explícita; por padrão é usado `yzzy.config.json` no workspace, com defaults para campos omitidos. Campos desconhecidos são rejeitados. O operador deve revisar configuração de um repositório não confiável antes de habilitar execução.

Precedência: defaults → arquivo JSON → `YZZY_PROVIDER`, `YZZY_MODEL`, `YZZY_BASE_URL`. Flags da CLI concedem edição/execução. `.env.example` é referência, não carregado automaticamente.

O padrão é `provider:codex`, modelo vazio para escolher o padrão da conta e `yzzy` sem subcomando abre chat. Use `yzzy login`, `yzzy login status`, `yzzy models` e `yzzy doctor`. O [guia Codex](CODEX.md) descreve o App Server e sua fronteira de confiança. O [guia de agentes](AGENTES-E-MEMORIA.md) detalha personalização e memória.

Compatibilidade de leitura: se `yzzy.config.json` não existir, tenta `wzzy.config.json`. `YZZY_*` prevalece sobre variáveis legadas `WZZY_*`; `YZZY.md` prevalece sobre `WZZY.md`. `--config` explícito nunca é substituído silenciosamente. Configurações legadas continuam escolhendo o backend que declaravam. Sessões antigas em `.wzzy/` são preservadas, mas não migradas ou retomadas automaticamente: o runtime mudou. Os dois diretórios de estado e os nomes de controle antigos continuam protegidos.

## Inferência local

Instale e inicie Ollama conforme sua [documentação oficial](https://docs.ollama.com/quickstart). O adaptador usa [`POST /api/chat`](https://docs.ollama.com/api/chat), `stream:false`, ferramentas e `think:false`. Escolha um modelo instalado que aceite essas capacidades e tenha contexto suficiente. O projeto não presume capacidade de GPU, memória nem licença dos pesos.

```powershell
$env:YZZY_PROVIDER = "ollama"
$env:YZZY_MODEL = "<modelo-instalado-com-tool-use>"
$env:YZZY_BASE_URL = "http://127.0.0.1:11434"
node bin/yzzy.js doctor
node bin/yzzy.js run "Localize a função de autenticação e explique suas dependências"
```

URLs Ollama são restritas ao loopback. Servidor remoto exige desenho adicional de autenticação e rede. Caso o servidor rejeite `think:false`, selecione um modelo/versão compatível; o erro não é escondido nem repetido indefinidamente.

## OpenAI Responses

O adaptador usa [function calling oficial](https://developers.openai.com/api/docs/guides/function-calling), schemas estritos, `store:false`, `parallel_tool_calls:false` e preservação dos itens necessários entre chamadas. O endpoint é fixado a `https://api.openai.com/v1`; credencial não segue redirects. Este adaptador HTTP requer chave de API própria. Login ChatGPT é oferecido separadamente pelo backend `codex`, sem converter o cache de autenticação em chave de API.

Defina `YZZY_PROVIDER=openai`, `YZZY_MODEL` e `OPENAI_API_KEY`. Ao trocar o provedor padrão por ambiente, a URL é ajustada para OpenAI se ainda estiver no default Ollama. Se `YZZY_BASE_URL` estiver definido para Ollama, remova-o antes da troca:

```powershell
Remove-Item Env:YZZY_BASE_URL -ErrorAction SilentlyContinue
$env:YZZY_PROVIDER = "openai"
$env:YZZY_MODEL = "<modelo-acessivel-na-conta>"
$env:OPENAI_API_KEY = "<chave>"
```

Crie uma cópia de configuração e preencha `pricing` com os valores da [página oficial de preços](https://developers.openai.com/api/docs/pricing). Unidade dos campos `input` e `output`: **microdólares por milhão de tokens**. Por exemplo, um preço hipotético de US$2/M é representado por `2000000`. Esse exemplo de conversão não indica o preço de nenhum modelo.

```json
{
  "pricing": {
    "input": 2000000,
    "output": 10000000,
    "source": "https://developers.openai.com/api/docs/pricing",
    "asOf": "2026-10-20"
  }
}
```

Use valores conservadores para todas as faixas/modos que o pedido possa atingir e atualize data e fonte. Cache é contabilizado como entrada cheia: não há desconto presumido. Reserva = estimativa de entrada de um token por byte + 4096 de margem, acrescida do teto de saída. Timeout/uso ausente mantém a reserva. Não é garantia contratual de teto de cobrança; estabeleça também limites de conta no provedor. Não configure preço zero para contornar admissão.

## Permissões e execução

```powershell
node bin/yzzy.js run "Corrija a função em src/" --allow-write
node bin/yzzy.js run "Corrija e verifique a função" --allow-write --allow-exec
```

`writeRoots` usa prefixos de diretório ou caminhos exatos, sem globs. O padrão autoriza somente `src`, `tests` e `docs` quando a flag de edição está presente. Arquivos de controle, estado, segredos reconhecidos e avaliadores no diretório `evaluations` continuam protegidos contra escrita. Não existe opção `--yes` que desligue toda a política.

Docker com containers Linux é obrigatório para `run_check`. Prepare previamente a imagem e dependências autorizadas:

```powershell
docker pull node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
npm.cmd run test:docker
```

A referência padrão está fixada por digest obtido da imagem oficial e testado nesta entrega, registrado em `yzzy.config.json`. Para atualizar a imagem ou mudar linguagem, valide a imagem preparada e substitua `docker.image` por uma referência com digest. O executor usa `--pull=never`, não instala dependências nem abre rede. Para Java ou Python, escolha imagem com ferramentas e dependências necessárias e adapte os `argv` cadastrados. Não use instalações de pacote no comando de verificação: snapshots são somente leitura e rede é negada.

`commands` mapeia nomes para arrays `argv`; o modelo escolhe apenas o nome, sem fornecer novos argumentos. Todos os comandos executam em snapshots. Defina `verification:true` apenas para comandos que realmente verificam o projeto. Projetos que geram arquivos devem gravar em `/tmp` e apontar seus caches para `/tmp`. O executor não publica alterações geradas pelo processo.

## Limites padrão

| Recurso | Valor |
|---|---|
| Chamadas de modelo / ferramenta | 24 / 80 por sessão |
| Prazo absoluto / requisição / comando | 15 min / 120 s / 60 s |
| Saída do modelo | 4096 tokens nos adaptadores HTTP; no Codex há limite em bytes, sem teto nativo de tokens imposto |
| Contexto enviado | 180000 bytes antes da serialização específica do provedor |
| Arquivo lido / resultado de ferramenta | 1 MiB / 32 KiB |
| Scan | 2000 entradas visitadas; inclui diretórios e entradas ignoradas |
| Snapshot | 8 MiB por arquivo, 32 MiB total |
| Orçamento | 1000000 microUSD = US$1 no ledger da API OpenAI direta; Codex é gerido pelo serviço, Ollama sem estimativa financeira |
| Repetição | terceira chamada idêntica na janela de 12 propostas interrompe |
| Container | 512 MiB RAM, 1 CPU, 64 PIDs, tmpfs de 64 MiB |

Use `read_lines` para arquivos grandes. A compactação extrativa é configurável por `autoSummary`, registra evento e preserva o transcript integral; `/compact` solicita projeção no próximo turno. Se o contexto projetado ainda exceder o teto total, a chamada é bloqueada. O tempo de sessão inclui espera entre retomadas. Operações locais de arquivo são cooperativas; limpeza de Docker pode acrescentar até duas tentativas de 10 s ao prazo do comando.

## Sessões e diagnóstico

Sessões ficam em `<workspace>/.yzzy/sessions/<uuid>.jsonl`, ignoradas pelo Git. `sessions` lista e `inspect <uuid>` valida integridade e mostra eventos. `resume <uuid> "resposta"` exige a mesma configuração e flags. O journal mantém código, resultados e histórico selecionados; trate-o como dado sensível. Redação por nomes de variáveis/formatos conhecidos não substitui revisão de dados.

Após crash, um lock antigo é preservado. Leia `.yzzy/workspace.lock`, confira o PID e remova somente esse lock se o processo não estiver mais ativo. Se um container ficou pendente, inspecione os nomes `yzzy-*` e remova o container específico após conferir a sessão. Não há limpeza indiscriminada de recursos Docker. Cauda incompleta ou journal adulterado é rejeitado; preserve uma cópia e comece nova sessão após revisar os efeitos.

No chat, use `/new` e `/exit`. `Ctrl+C` cancela a sessão ativa. Em automação, `--json` emite somente objetos JSONL em stdout. Erros de inicialização vão para stderr. Códigos: 0 término operacional; 2 erro; 3 limite; 4 pergunta; 5 falha/efeito incerto; 130 cancelamento. Interprete também o campo `status`.

Desde 0.2.1, a interface humana apresenta mensagens, perfis, resumos e permissões sem JSON ou IDs em cada turno. `/status` e `/history` continuam mostrando identificadores quando solicitados. Tab completa comandos; setas recuperam entradas desta execução. O indicador animado só opera em terminal interativo e é limpo ao terminar/cancelar. Cores dependem do terminal, respeitam `NO_COLOR`, `FORCE_COLOR=0` e `TERM=dumb`; redirecionamento usa texto simples por padrão. Respostas e caminhos são redigidos e filtrados antes de aplicar estilos, inclusive sequências de controle de terminal vindas do modelo.

Desde 0.2.3, o globo rotativo com continentes estilizados e grade geográfica permanece no cabeçalho durante toda a conversa, inclusive enquanto se digita. Um mini globo de 7×3 caracteres, calculado com subpixels Braille 2×4, gira ao lado do rótulo de atividade no rodapé: “Pensando”, leitura, pesquisa ou execução. Cabeçalho e atividade usam timers independentes; uma resposta encerra a atividade e mantém o globo principal girando. A animação não usa o modelo, rede ou credenciais.

Em terminal compatível, o chat usa tela alternativa e margens de rolagem VT para separar cabeçalho, conversa e atividade. Atualizações preservam e restauram o cursor. Redimensionar recompõe o layout e restaura texto e posição de edição com APIs públicas do readline. PgUp/PgDn navegam por até 5000 linhas da apresentação atual; o journal completo continua independente desse limite visual. Ao sair ou encerrar o chat, são removidos timers/listeners e restaurados cursor, estilos, margens e a tela anterior. Use `history`, `summary` ou `export` para consultar conversas depois de sair. Os mecanismos seguem as interfaces de [terminal virtual do Windows](https://learn.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences) e [readline do Node.js](https://nodejs.org/docs/latest-v24.x/api/readline.html).

`yzzy --no-animation` ou `YZZY_ANIMATION=0` mantêm a apresentação estática e linear. Pipes, CI, `TERM=dumb` e janelas muito pequenas também usam fallback. `NO_COLOR` desativa a paleta, preservando movimento quando o terminal o suporta. `npm.cmd run preview:terminal` mostra cabeçalho e mini globo com atividade simulada, sem inferência nem alteração de arquivos. A paleta cyber usa painel preto e destaques ciano/violeta sem alterar permanentemente as cores do CMD.

Uma conversa sem evidências não exige `snapshot`: isso permite cumprimentar ou tirar dúvidas a partir da pasta pessoal sem varrer milhares de arquivos. O status continua sem verificação. Se houver evidência a aprovar, a revisão completa e o limite `maxScanFiles` continuam obrigatórios; não aumentamos limites nem aceitamos snapshot truncado. Para trabalhar no código de um projeto, abra o terminal naquela pasta ou use `yzzy --workspace "C:/caminho/do/projeto"`.

`doctor` faz consultas de disponibilidade, sem inferência. Um ambiente que bloqueia o pipe Docker pode apresentar indisponibilidade no sandbox mesmo com daemon ativo fora dele. Execute os comandos de validação em um terminal com acesso autorizado ao daemon.

## Ausência de arquivos: ENOENT e -4058

No Node.js em Windows, `errno:-4058` corresponde a `ENOENT`. `syscall:open` informa falha ao abrir um caminho; um ancestral também pode estar ausente. Com `syscall:spawn ...`, confira executável, `PATH` e diretório de execução. A aplicação usa o código estável `ENOENT` para a decisão, em vez de depender do número específico do SO.

A estratégia é recuperar conforme o papel do arquivo:

| Situação | Comportamento |
|---|---|
| Configuração padrão não encontrada | Usa defaults sem criar arquivo |
| `YZZY.md` opcional ausente | Continua sem orientação adicional |
| Configuração informada por `--config` ausente | Diagnóstico explícito; não substitui silenciosamente a escolha do operador |
| Arquivo solicitado por ferramenta ausente | Resultado `ok:false`, código, caminho e orientação; o agente pode listar arquivos e corrigir sua próxima proposta |
| Arquivo ainda precisa ser criado | Exige tarefa que o justifique, `--allow-write` e `writeRoots`, como antes |
| Acesso negado, JSON/UTF-8 inválido ou política bloqueada | Não é convertido em arquivo vazio/default |
| Efeito de ferramenta incerto | Revisão manual; a recuperação não autoriza replay |

Resultados de erro distinguem `recoverable` (o fluxo pode se recuperar após corrigir a causa) de `retryable` (repetir automaticamente a mesma operação). Um caminho ausente recebe `recoverable:true` e `retryable:false`; o controlador não faz retry nem troca o arquivo por uma aproximação. A continuação depende da próxima proposta do modelo e conserva os limites de chamadas, tempo e repetição. Orientações inválidas ou inacessíveis passam a ser diagnosticadas em vez de serem ignoradas pela leitura opcional.

O [Node.js recomenda executar a operação e tratar sua falha](https://nodejs.org/docs/latest-v24.x/api/fs.html#fsaccesspath-mode-callback), pois consultar existência antes de abrir não elimina corridas. O [Cosmiconfig](https://github.com/cosmiconfig/cosmiconfig#explorersearch) também distingue configuração não encontrada de configuração malformada. A YZZY BLACK aplica a distinção com APIs nativas, sem adicionar essa dependência nem buscar configuração fora do workspace.

O requisito de Node.js 24+ continua válido. Esta recuperação não adiciona suporte ao Node.js 20.11.0 nem corrige automaticamente uma instalação externa de outro CLI. Para diagnosticar esse outro programa, ainda é necessário o `path` completo do erro.

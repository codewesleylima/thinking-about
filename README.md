# YZZY BLACK

**Versão 0.3.0:** equipe coordenada com 19 perfis de especialidade, consultas sequenciais, orçamento agregado e leitura de documentação HTTPS autorizada. O estudo detalhado do Codex público, incluindo Java e engenharia reversa, começa em [docs/codex](docs/codex/README.md). O recorte de fontes upstream é fixado por commit e hashes, com script de reprodução.

Agente de programação no terminal com perfis, preferências, histórico e guardrails próprios, baseado no [estudo científico do projeto](estudo_agentes_ia_cli_arquitetura_implementacao_validacao.md). O backend padrão usa o Codex com autenticação oficial. Digite `yzzy` no CMD para conversar.

O chat 0.2.3 mantém o globo cyber girando no cabeçalho enquanto você conversa ou digita. Durante o processamento, um mini globo rotativo de 7×3 caracteres aparece ao lado de “Pensando” ou da ação atual. O painel preto usa ciano e violeta, com áreas separadas para cabeçalho, conversa e atividade. PgUp/PgDn navegam pelo histórico visível. Ao sair, a tela anterior do terminal é restaurada; conversas completas permanecem no journal e podem ser exportadas. A interface adapta-se à janela e funciona sem cores. `yzzy --no-animation` usa apresentação estática. `npm.cmd run preview:terminal` demonstra as animações sem chamar o modelo. Ajuda organizada e Tab completam a interface. Conversas comuns não mostram IDs, eventos internos ou JSON; `--json` mantém o protocolo de automação. Uma saudação não dispara revisão de arquivos; verificações de código continuam exigindo snapshot completo.

A YZZY BLACK é um **runtime de agente com modelos substituíveis**. Não contém pesos próprios treinados nem pressupõe equivalência a produtos comerciais. Distingue resposta do modelo, ação executada e verificação independente.

Para entender como outro projeto pode construir um sistema semelhante preservando os controles, leia o [Guia científico de replicação](GUIA_CIENTIFICO_DE_REPLICACAO.md), na raiz: fundamentos, contratos, guardrails, roteiro de implementação e critérios de avaliação.

## Começar agora

Requisito: **Node.js 24+**. O pacote inclui `@openai/codex@0.163.0`, com versão fixada no lock.

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd install --global . --ignore-scripts --no-audit --no-fund
npm.cmd run install:cmd
yzzy login status
yzzy
```

Abra outro CMD após `install:cmd`, que acrescenta somente o prefixo npm ao PATH do usuário, preservando entradas existentes. O script revisável usa política de execução apenas para seu próprio processo, sem mudar a política permanente do PowerShell. Sem autenticação, execute `yzzy login` ou `yzzy login --device-auth`. O fluxo é oficial do Codex; a YZZY não copia tokens. A instalação global do diretório liga o comando ao checkout: mantenha-o no lugar. Não é necessário publicar no npm. Linux/macOS: use `npm` e configure o PATH do shell; `install:cmd` é específico de Windows.

Abra o CMD no projeto desejado ou use `yzzy --workspace C:/projetos/app`. O padrão é leitura. Para editar, use `yzzy --agent coder --allow-write`; comandos cadastrados também exigem `--allow-exec` e Docker. Docker não é necessário para conversar, pesquisar ou editar.

## Agentes, interação e memória

```bat
yzzy agent list
yzzy agent create mentor --instructions "Explique em português com exemplos e confirme requisitos ambíguos." --read-only
yzzy settings set verbosity detailed
yzzy settings set clarification essential
yzzy --agent mentor
```

Além dos perfis gerais, há `orchestrator`, `engineer`, `architect`, `patterns`, `java`, `debugger`, `reverse_engineer`, `frontend`, `tester`, `integrations`, `security`, `performance`, `data`, `devops` e `technical_writer`. `reviewer`, `researcher` e `security` são somente leitura mesmo com flags de escrita. No chat, `/help` mostra `/agents`, `/agent`, `/team`, `/settings`, `/set`, `/model`, `/history`, `/resume`, `/summary`, `/compact`, `/permissions`, `/new` e `/exit`. Ctrl+C cancela a operação atual.

```bat
yzzy --agent java
yzzy team plan "Investigue um erro em biblioteca interna Java"
yzzy team run "Analise o problema descrito em docs/bug.md" --specialists java,debugger,tester
yzzy team run "Corrija a tarefa documentada no projeto" --specialists architect,java,tester --allow-write --allow-exec --allow-network
yzzy team inspect <id-da-equipe>
```

Na equipe, consultas nunca editam nem executam comandos; o coordenador conserva as permissões efetivas do perfil humano. `--allow-network` habilita apenas `read_documentation`, com destinos em `documentation.allowedHosts`; não há busca aberta nem navegador. As sessões compartilham limites e não podem ser retomadas isoladamente. Leia [equipe e orçamento](docs/codex/04-EQUIPE-E-ORQUESTRACAO.md) e [pesquisa/validação](docs/codex/07-PESQUISA-E-VALIDACAO.md). O perfil Java orienta análise; JDK, debugger e ambiente de build não são instalados por ele.

Conversas e preferências ficam em `.yzzy/` de cada projeto. Resumos extrativos locais preservam requisitos humanos, permissões e referências de evidência sem apagar o histórico completo. `yzzy history`, `yzzy summary <id>`, `yzzy resume <id>` e `yzzy export <id> --output conversa.md` permitem inspecionar, retomar e exportar. Veja [agentes e memória](docs/AGENTES-E-MEMORIA.md).

`yzzy models` consulta modelos disponíveis; `yzzy doctor` verifica disponibilidade sem inferência. No backend Codex, uso e cobrança pertencem ao produto/plano autenticado: `maxCostMicrousd` e `maxOutputTokens` da API direta não impõem tetos à inferência nativa. [Integração e limites](docs/CODEX.md).

## Usar um modelo local

Instale o [Ollama](https://docs.ollama.com/quickstart), inicie o servidor e baixe um modelo com suporte a ferramentas adequado ao seu hardware:

```powershell
ollama pull <modelo-com-ferramentas>
$env:YZZY_MODEL = "<modelo-com-ferramentas>"
$env:YZZY_PROVIDER = "ollama"
node bin/yzzy.js run "Explique a arquitetura deste repositório com referências aos arquivos"
```

O backend alternativo Ollama usa `http://127.0.0.1:11434`. Informe o identificador exato instalado. Nenhum peso é baixado implicitamente.

## Usar a API OpenAI

```powershell
$env:YZZY_PROVIDER = "openai"
$env:YZZY_MODEL = "<identificador-disponivel-na-sua-conta>"
$env:OPENAI_API_KEY = "<sua-chave>"
node bin/yzzy.js run "Revise src/ e apresente problemas verificáveis"
```

Antes da primeira chamada paga, configure `pricing` com preços inteiros em microdólares por milhão de tokens, fonte e data. Preços ausentes impedem a chamada. Consulte o [guia de configuração](docs/CONFIGURACAO.md). Chaves ficam em variáveis de ambiente. O código selecionado pelas ferramentas é enviado ao provedor escolhido.

## Comandos

```text
node bin/yzzy.js init --workspace C:/projetos/meu-app
node bin/yzzy.js run "Corrija o bug" --workspace C:/projetos/meu-app
node bin/yzzy.js chat --workspace C:/projetos/meu-app
node bin/yzzy.js sessions --workspace C:/projetos/meu-app
node bin/yzzy.js inspect <session-id>
node bin/yzzy.js resume <session-id> "Continue com esta orientação"
node bin/yzzy.js run "Analise src" --json
```

`init` cria configuração e instruções sem sobrescrever arquivos. `--config caminho.json` seleciona outra configuração. O padrão permite leitura; `--allow-write` autoriza edições dentro de `writeRoots`. Para comandos cadastrados, também use `--allow-exec`: Docker é obrigatório. Consulte [segurança](docs/SEGURANCA.md).

## Documentação e evidências

| Documento | Conteúdo |
|---|---|
| [Agentes e memória](docs/AGENTES-E-MEMORIA.md) | Perfis, dúvidas, preferências, resumo e retomada |
| [Codex](docs/CODEX.md) | Autenticação, protocolo e fronteiras de inferência |
| [Análise do estudo](docs/ANALISE-DO-ESTUDO.md) | Interpretação científica, requisitos e limites |
| [Arquitetura](docs/ARQUITETURA.md) | Componentes, ciclo e decisões técnicas |
| [Configuração](docs/CONFIGURACAO.md) | Provedores, permissões, Docker e sessões |
| [Segurança](docs/SEGURANCA.md) | Fronteiras reais e limitações |
| [Avaliação](docs/AVALIACAO.md) | Protocolo, tarefas e reprodução |
| [Validação realizada](docs/VALIDACAO.md) | Resultados efetivamente observados |
| [Evolução](docs/ROADMAP.md) | Implementado e próximos critérios de aceite |

CI verifica testes, sintaxe, empacotamento e avaliação determinística em Windows, Linux e macOS. `npm.cmd run test:codex` faz inferência real; `npm.cmd run test:codex:edit` edita uma fixture e usa avaliador independente em Docker; `npm.cmd run test:codex:cli` valida perfil personalizado, perguntas e retomada entre processos. Consomem cota da conta. `yzzy demo` é roteirizado e não usa LLM. O estudo original é preservado integralmente.

A versão 0.3.0 implementa coordenação sequencial própria. MCP próprio, plugins executáveis, LSP, debugger JVM, ambiente Java preparado e subagentes concorrentes ainda exigem implementação. Perfis não são modelos treinados nem agentes paralelos.

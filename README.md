# WZZY AI

Agente de programação no terminal, baseado no [estudo científico do projeto](estudo_agentes_ia_cli_arquitetura_implementacao_validacao.md). Lê e pesquisa código, aplica edições com hash de revisão, executa comandos cadastrados em Docker e registra sessões retomáveis. Interface e documentação em português.

A WZZY AI é um **runtime de agente com modelos substituíveis**. Não contém pesos próprios treinados nem pressupõe equivalência a produtos comerciais. Distingue resposta do modelo, ação executada e verificação independente.

## Começar agora

Requisito: **Node.js 24+**. Sem dependências externas de runtime.

```powershell
node bin/wzzy.js doctor
node bin/wzzy.js demo
npm.cmd test
npm.cmd run evaluate
```

Linux/macOS: use `npm`. A demonstração cria um diretório temporário, corrige uma regra de maioridade com propostas roteirizadas e executa um avaliador independente. **Não usa LLM e não mede inteligência**. Imprime o caminho da sessão para inspeção.

## Usar um modelo local

Instale o [Ollama](https://docs.ollama.com/quickstart), inicie o servidor e baixe um modelo com suporte a ferramentas adequado ao seu hardware:

```powershell
ollama pull <modelo-com-ferramentas>
$env:WZZY_MODEL = "<modelo-com-ferramentas>"
node bin/wzzy.js run "Explique a arquitetura deste repositório com referências aos arquivos"
```

O padrão é Ollama em `http://127.0.0.1:11434`. Informe o identificador exato instalado. Nenhum peso é baixado implicitamente.

## Usar a API OpenAI

```powershell
$env:WZZY_PROVIDER = "openai"
$env:WZZY_MODEL = "<identificador-disponivel-na-sua-conta>"
$env:OPENAI_API_KEY = "<sua-chave>"
node bin/wzzy.js run "Revise src/ e apresente problemas verificáveis"
```

Antes da primeira chamada paga, configure `pricing` com preços inteiros em microdólares por milhão de tokens, fonte e data. Preços ausentes impedem a chamada. Consulte o [guia de configuração](docs/CONFIGURACAO.md). Chaves ficam em variáveis de ambiente. O código selecionado pelas ferramentas é enviado ao provedor escolhido.

## Comandos

```text
node bin/wzzy.js init --workspace C:/projetos/meu-app
node bin/wzzy.js run "Corrija o bug" --workspace C:/projetos/meu-app
node bin/wzzy.js chat --workspace C:/projetos/meu-app
node bin/wzzy.js sessions --workspace C:/projetos/meu-app
node bin/wzzy.js inspect <session-id>
node bin/wzzy.js resume <session-id> "Continue com esta orientação"
node bin/wzzy.js run "Analise src" --json
```

`init` cria configuração e instruções sem sobrescrever arquivos. `--config caminho.json` seleciona outra configuração. O padrão permite leitura; `--allow-write` autoriza edições dentro de `writeRoots`. Para comandos cadastrados, também use `--allow-exec`: Docker é obrigatório. Consulte [segurança](docs/SEGURANCA.md).

## Documentação e evidências

| Documento | Conteúdo |
|---|---|
| [Análise do estudo](docs/ANALISE-DO-ESTUDO.md) | Interpretação científica, requisitos e limites |
| [Arquitetura](docs/ARQUITETURA.md) | Componentes, ciclo e decisões técnicas |
| [Configuração](docs/CONFIGURACAO.md) | Provedores, permissões, Docker e sessões |
| [Segurança](docs/SEGURANCA.md) | Fronteiras reais e limitações |
| [Avaliação](docs/AVALIACAO.md) | Protocolo, tarefas e reprodução |
| [Validação realizada](docs/VALIDACAO.md) | Resultados efetivamente observados |
| [Evolução](docs/ROADMAP.md) | Implementado e próximos critérios de aceite |

CI verifica testes, sintaxe, empacotamento e avaliação determinística em Windows, Linux e macOS. Ensaios reais com modelo e Docker são separados. O estudo original é preservado integralmente.

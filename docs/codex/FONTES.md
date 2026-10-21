# Fontes e critérios de evidência

Consulta realizada em **21 de outubro de 2026**. Este registro acompanha o estudo do YZZY BLACK **0.3.0**, que estende o núcleo 0.2.3, incluindo modelo/harness, protocolo/contexto e comportamento/guardrails. As páginas online podem mudar após essa data. A versão do pacote utilizada no projeto é **`@openai/codex` 0.163.0**; um recurso descrito na documentação atual não é automaticamente suportado ou habilitado nessa versão nem em nosso adaptador.

## Documentação primária consultada

| Fonte | Uso no estudo | Limite de interpretação |
| --- | --- | --- |
| [Codex as a platform: build on the open agent harness](https://developers.openai.com/blog/codex-as-a-platform) | Separação entre aplicação, harness e acesso aos modelos; opções de integração. Publicação indicada: 19/08/2026. | Não revela pesos nem todos os componentes privados do serviço. |
| [Codex App Server](https://learn.chatgpt.com/docs/app-server) | Primitivas e ciclo de conexão do protocolo. | A implementação real usa somente um subconjunto e a compatibilidade depende do binário fixado. |
| [Authentication](https://learn.chatgpt.com/docs/auth) | Formas oficiais de autenticação e dependência da modalidade de conta. | Não demonstra plano, saldo ou disponibilidade da conta do usuário neste momento. |
| [Sandbox](https://learn.chatgpt.com/docs/sandboxing) | Distinção entre acesso operacional e política de aprovação. | Não atesta confinamento absoluto do nosso processo host. |
| [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) | Trabalho especializado, retorno ao coordenador e custo adicional. | Não representa uma capacidade nativa habilitada no adaptador YZZY. |
| [Codex Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide) | Referência pública de comportamentos de engenharia e uso de ferramentas. | Guia de famílias e versões específicas; não é o prompt privado completo de toda execução de Codex. |
| [Key concepts](https://developers.openai.com/api/docs/concepts) | Vocabulário de modelos de texto, tokens e contexto. | A explicação conceitual não especifica a arquitetura exata de um GPT fechado. |
| [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning) | Distinção entre processamento interno e saída pública. | Não concede acesso ao raciocínio privado da integração atual. |
| [Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering) | Papéis das mensagens e instruções de aplicação. | Hierarquia textual não substitui restrições de execução no host. |
| [Safety in building agents](https://developers.openai.com/api/docs/guides/agent-builder-safety) | Riscos de conteúdo não confiável, separação de dados e saída estruturada. | Princípios foram usados como referência; não utilizamos Agent Builder. |
| [Model optimization](https://developers.openai.com/api/docs/guides/model-optimization) | Avaliação iterativa e variabilidade entre modelos. | O projeto não contratou nem executou treinamento com essa consulta. |
| [Supervised fine-tuning](https://developers.openai.com/api/docs/guides/supervised-fine-tuning) | Conceito de ajuste por demonstrações e aviso atual de disponibilidade. | A oferta consultada está em encerramento gradual e não aceita novos usuários; não prometemos acesso. |
| [Reinforcement fine-tuning](https://developers.openai.com/api/docs/guides/reinforcement-fine-tuning) | Conceito de avaliação programável e ajuste de parâmetros. | Não permite concluir como foi treinado cada modelo Codex fechado; disponibilidade precisa ser reverificada. |
| [gpt-oss-20b](https://developers.openai.com/api/docs/models/gpt-oss-20b) | Exemplo público de modelo com pesos abertos. | Modelo diferente dos modelos fechados do Codex; nenhuma equivalência foi medida. |
| [How to run gpt-oss with Transformers](https://developers.openai.com/cookbook/articles/gpt-oss/run-transformers) | Exemplo de caminho para inferência em infraestrutura controlada. | Não houve instalação, download de pesos ou benchmark de hardware nesta tarefa. |

Os capítulos são sínteses originais. Não incorporamos longos trechos de prompts, páginas, código ou manuais externos aos textos explicativos. As explicações extensas do funcionamento do YZZY vêm de inspeção do nosso código; as referências externas apoiam conceitos e superfícies públicas delimitadas. Os arquivos upstream usados para estudo ficam separados em cache local, com origem, licença e hashes registrados.

## Recorte versionado do código público do Codex

Além das páginas acima, a entrega inclui estudo de **15 arquivos públicos** do repositório [openai/codex](https://github.com/openai/codex/tree/83086188ae0614bd882818ff1aa23f3194962012), no commit **`83086188ae0614bd882818ff1aa23f3194962012`**, associado à tag `rust-v0.163.0`. O objeto de tag registrado é `129b8ec7ee6f4511557a4856279f529025c25af4`. A coleta consta no manifesto com horário `2026-10-21T06:06:58.610Z`.

[UPSTREAM.json](UPSTREAM.json) identifica cada caminho, URL fixada por commit, SHA-256 dos bytes originais, tamanho e número de linhas. O recorte cobre licença e aviso, README do App Server, roteamento/orquestração de ferramentas, configuração, compactação, sessões, controle de agentes e montagem pública de instruções. O manifesto também preserva caminhos procurados que não existem nessa revisão; um nome esperado de versão antiga não foi apresentado como arquivo encontrado.

Os bytes ficam em `.yzzy/research/codex/<commit>/`, fora do código executável do produto e fora das ferramentas comuns de leitura do agente. A coleta administrativa foi feita por [scripts/study-codex-source.js](../../scripts/study-codex-source.js), que baixa texto e não executa o conteúdo upstream. O script oferece `--verify` para conferir os hashes no cache sem rede e `--refresh` para coletar o recorte novamente pela origem pública. A autorização de rede dessa operação administrativa é separada da ferramenta de documentação disponibilizada ao modelo.

A explicação dos pontos estudados, referências versionadas e limites desse recorte está em [08-EXTRACAO-DO-CODIGO-PUBLICO.md](08-EXTRACAO-DO-CODIGO-PUBLICO.md). Arquivos públicos de montagem de instruções são evidência sobre aquele código e commit; não demonstram o prompt efetivo completo de cada serviço ou conta, nem instruções privadas de produção.

## Fontes locais que fundamentam as descrições de implementação

| Arquivo | Evidência que fornece |
| --- | --- |
| [package.json](../../package.json) | Versão do produto, dependência oficial e comandos do projeto. |
| [src/agent.js](../../src/agent.js) | Ciclo de controle, instruções, concessões, validações, retomada e estados finais. |
| [src/codex-provider.js](../../src/codex-provider.js) | Inferência efêmera, overrides, schema, eventos e metadados do modelo. |
| [src/codex-rpc.js](../../src/codex-rpc.js) | Executável, ambiente, transporte, correlação e recusa de pedidos nativos. |
| [src/tools.js](../../src/tools.js) | Catálogo de ferramentas, schema e política anterior à execução. |
| [src/workspace.js](../../src/workspace.js) | Política de arquivos, hash de edição, criação exclusiva e snapshot. |
| [src/executor.js](../../src/executor.js) | Processo sem shell, limites e configuração do container de verificações. |
| [src/journal.js](../../src/journal.js) | Persistência, cadeia de integridade e lock cooperativo. |
| [src/memory.js](../../src/memory.js) | Resumo extrativo e projeção do contexto. |
| [src/profiles.js](../../src/profiles.js) | Perfis, preferências, identidade e instruções da persona. |
| [src/specialists.js](../../src/specialists.js) | Catálogo de especialidades e contratos de parecer. |
| [src/team.js](../../src/team.js) | Roteamento, consultas sequenciais, coordenador, permissões herdadas e ledger agregado. |
| [src/documentation.js](../../src/documentation.js) | URLs autorizadas, validação DNS, conexão fixada, timeout e proveniência da consulta externa. |
| [src/errors.js](../../src/errors.js) | Classificação de falhas, fallback opcional e estratégias de recuperação. |
| [src/budget.js](../../src/budget.js) | Admissão de recursos e cálculo monetário específico da API direta. |
| [tests/team.test.js](../../tests/team.test.js) | Cenários executáveis da equipe, permissões, limites e bloqueio de retomada isolada. |
| [tests/documentation.test.js](../../tests/documentation.test.js) | Cenários executáveis de URLs, DNS, redirects, permissão, cancelamento e limite de saída. |

Os testes listados são fontes dos cenários e critérios; a execução realizada e seus resultados devem ser conferidos em [07-PESQUISA-E-VALIDACAO.md](07-PESQUISA-E-VALIDACAO.md). A organização e os comandos de equipe estão em [04-EQUIPE-E-ORQUESTRACAO.md](04-EQUIPE-E-ORQUESTRACAO.md).

## O que não foi observado

Não acessamos pesos fechados, dados privados de treinamento, prompts privados de produção, infraestrutura interna, algoritmos proprietários de distribuição ou todas as avaliações internas da OpenAI. Respostas do modelo não permitem reconstruir esses componentes de maneira exata. A palavra “reprodução” nesta série significa implementação própria de contratos e comportamentos verificáveis.

A disponibilidade de um link para código aberto na documentação não demonstra que todo o produto ou modelo é aberto. Não importamos uma árvore upstream completa do Codex como implementação do YZZY. Baixamos um recorte público para estudo versionado e preservamos sua proveniência separadamente; o executável oficial continua sendo consumido como dependência. Nosso controlador e os textos desta série permanecem identificados como nossa implementação. Esse procedimento não é extração de pesos fechados nem dump de dados privados.

## Como manter este estudo reproduzível

1. Registrar data, versão do pacote, configuração e modelo realmente resolvido em cada experimento.
2. Para uma afirmação pública nova, consultar a página oficial que a sustenta e anexar o link no capítulo correspondente.
3. Para uma afirmação sobre o YZZY, apontar módulo, contrato e verificação executável quando houver.
4. Tratar proposta como proposta até existir caminho implementado e validado.
5. Ao atualizar Codex, verificar protocolo, nomes de eventos, políticas e recursos que desativamos; atualizar textos quando o contrato mudar.
6. Preservar um conjunto de tarefas de regressão para comparar sucesso, falhas, custo e limites entre versões. Uma demonstração bem-sucedida isolada não prova equivalência geral.
7. Para fontes upstream, fixar commit e verificar SHA-256 no manifesto antes de usar o cache como evidência; preservar licença e aviso. Atualizar a análise se a revisão ou o recorte mudar.

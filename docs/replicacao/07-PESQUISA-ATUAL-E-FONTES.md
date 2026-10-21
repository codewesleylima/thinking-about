# 7. Estruturas atuais de mercado e decisões para uma réplica

**Consulta em 21/10/2026.** Pergunta: quais padrões aparecem hoje nas fontes primárias de plataformas de agentes e como aproveitá-los sem acrescentar complexidade sem necessidade? Esta é uma análise documental, não uma medição de participação de mercado, benchmark comercial ou lista de vencedores.

## 7.1 Conclusão sustentada pela pesquisa

As fontes consultadas convergem em tratar o agente como sistema com runtime, estado, ferramentas e ambiente. A tendência útil para este projeto é **engenharia do harness**: tornar contexto, execução, recuperação e avaliação componentes de software examináveis. A forma de hospedagem varia.

Essa conclusão não implica que todas as plataformas sejam equivalentes ou que exista uma arquitetura universal. Custos, isolamento, linguagem, controle do loop, operação e exigências de dados mudam a escolha. O YZZY permanece um monólito modular com adaptadores e workers, um ponto de partida deliberadamente menor que uma plataforma distribuída.

## 7.2 Rotas de plataforma observadas

| Rota | Evidência pública | Quando considerar | Custo de adoção no destino |
| --- | --- | --- | --- |
| Harness gerenciado | Serviços atuais administram parte de estado/loop/ambiente | Quando a prioridade é integração e operação gerida | Dependência do serviço, modalidade de conta e contratos de dados. |
| SDK de agentes dentro da aplicação | Loop e handoffs integrados ao código do produto | Quando já existem ferramentas e armazenamento da aplicação | Entender lifecycle, política e continuidade do SDK. |
| API de modelo e harness próprio | Controle explícito das propostas e efeitos | Quando contratos próprios e observabilidade são centrais | Implementar estado, tool loop, política e avaliação. |
| Grafo stateful/workflow | Nós, transições e checkpoints | Processos longos com etapas e recuperação definidas | Definir efeitos/idempotência e semântica de retomada. |
| Harness oficial por protocolo local | Runtime oficial integrado a outra interface | Clientes que precisam autenticação/eventos existentes | Compatibilidade de versão e base de confiança do processo. |

A documentação OpenAI distingue Agents API gerenciada, Agents SDK na aplicação e Responses API com controle próprio. Essas opções diferem em onde roda a orquestração e quem mantém o estado. Nosso adaptador Codex usa outra superfície oficial, App Server, com ferramentas do host desativadas no motor. Não migramos para Agents API nesta entrega. [OpenAI — Agents](https://developers.openai.com/api/docs/guides/agents).

## 7.3 Separar sessão, harness e ambiente

A engenharia pública da Anthropic descreve interfaces distintas para sessão persistida, loop de agente e ambientes/ferramentas. A lição aplicável é permitir substituir ou recuperar um componente sem perder a história nem expor credenciais ao código executado. A referência YZZY aplica parte disso localmente; não implementa o serviço gerenciado descrito pela empresa. [Anthropic — Managed Agents](https://www.anthropic.com/research/managed-agents).

**Decisão nossa:** conservar o journal fora do worker Docker e manter credenciais da inferência fora do snapshot. O shell do host permanece um modo de confiança explícito, não uma tentativa de imitar a fronteira do worker. Se um destino precisa isolamento forte e acesso a vários ambientes, projete concessões de worker antes de ampliar o shell.

## 7.4 Persistência e workflows duráveis

LangGraph se apresenta como runtime de orquestração stateful e documenta checkpointers para estado de thread e stores para informação entre execuções. Esse é um caminho de adoção quando a semântica de grafo e recuperação resolve uma necessidade real. A simples troca de JSONL por checkpointer não torna todos os efeitos repetíveis com segurança. [LangGraph — overview](https://docs.langchain.com/oss/javascript/langgraph/overview), [Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence).

**Decisão nossa:** continuar com recuperação conservadora e bloquear operações incertas. Um futuro workflow precisa identificar cada efeito externo e saber consultá-lo depois de queda. Priorize reconciliação antes de prometer retomada transparente de shell, deploy ou pagamentos. R26 descreve esse gate.

## 7.5 Implementação e avaliação devem estar separadas

A pesquisa de harness para aplicações longas discute como desenho do processo e avaliação influenciam a qualidade, inclusive em tarefas de interface. Usamos isso como motivação para manter critérios verificáveis e crítica, sem atribuir a esta base os resultados experimentais de outro sistema. [Anthropic — harness design](https://www.anthropic.com/research/harness-design-long-running-apps).

O cookbook OpenAI mostra um ciclo de melhoria baseado em traces, feedback, avaliações e gates. A ideia transferível é comparar versões do harness com dados, sem transformar uma edição automática em promoção automática. Não integramos esse exemplo nem um serviço de evals na aplicação atual. [OpenAI — agent improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop).

**Decisão nossa:** conservar laboratório offline, smokes reais e resultado de produto como classes distintas. Um revisor especialista não substitui o teste independente. Mais agentes só são uma melhoria se o ganho superar custo e novas falhas sob orçamento equivalente.

## 7.6 MCP é integração, não concessão automática

MCP oferece um protocolo de integração. A documentação de segurança cobre riscos como confused deputy, passthrough de tokens, SSRF e hijacking; o texto dos mantenedores diferencia anotações de risco de controles efetivos. Um servidor que declara ser readonly não se torna confiável só por esse rótulo. [MCP — security practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices), [MCP — annotations](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/).

**Decisão nossa:** não conectar automaticamente servidores encontrados em um repositório. O adaptador de inferência desabilita MCPs nativos configurados. Um futuro cliente próprio deve revisar ferramenta, identidade, credenciais, destino, timeout e autorização. R25 permanece planejado.

## 7.7 Contexto e memória

O uso de artefatos persistidos, compactação e recuperação seletiva aparece nas plataformas atuais. Isso favorece separar armazenamento recuperável de projeção enviada ao modelo. Nossa implementação é um extrator local; não afirmamos possuir recuperação semântica, contexto infinito ou memória perfeita.

**Decisão nossa:** preserve dados operacionais críticos no resumo e o transcript original no journal. Só adicione embeddings ou outro modelo de resumo depois de medir um problema que o extrator não resolve. Avalie também perda de restrições e vazamento entre tarefas, não só acerto de busca.

## 7.8 Observabilidade: verificar versão da própria convenção

A página oficial consultada informa que as convenções GenAI foram movidas para outro repositório e que o endereço antigo não é mais mantido. Isso é um exemplo concreto de por que não usar um link antigo como garantia de estado atual. Antes de implementar exportação, fixe a versão e o destino realmente consultados. [OpenTelemetry — página de migração](https://opentelemetry.io/docs/specs/semconv/gen-ai/).

**Decisão nossa:** o produto mantém seus eventos locais; exportação OpenTelemetry GenAI continua planejada. Um destino pode mapear chamada de modelo, ferramenta, sessão e custo para spans, mas deve redigir atributos e evitar prompts/credenciais por padrão. Não inventamos nomes de atributos estáveis sem verificar a versão adotada.

## 7.9 CMD e processos são infraestrutura de produto

As referências oficiais Microsoft/Node documentam o interpretador e o gerenciamento de subprocessos. A lição para o nosso design é separar execução de shell intencional de um executor de argv, e tratar cancelamento de árvore como um problema de lifecycle. Não usamos uma lista de comandos proibidos como substituto de sandbox. [Microsoft — cmd](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd), [Node.js 24 — child_process](https://nodejs.org/download/release/v24.19.0/docs/api/child_process.html).

**Decisão nossa:** shell do host é opt-in e diagnóstico; worker Docker permanece o caminho restrito. O limite real do mecanismo está documentado no capítulo 5, inclusive limpeza incerta de descendentes.

## 7.10 Recomendação prática de estrutura

Para uma réplica inicial, use núcleo modular pequeno, adaptadores explícitos, eventos persistidos, capacidade por ferramenta, worker isolado, memória com proveniência e avaliações. Gere uma base que abre e passa seus checks antes de distribuir trabalho por agentes.

Para uma aplicação com workflows já definidos e operação durável necessária, avalie um runtime de grafo ou workflow em vez de recriar filas e checkpoints. Para uma equipe que prefere operação gerenciada, avalie a plataforma conforme dados/conta/custo. Para um cliente de Codex autenticado, mantenha o protocolo oficial e valide a versão instalada.

Nenhuma dessas recomendações requer instalar todas as bibliotecas citadas. O estado atual da nossa implementação e o backlog estão na especificação. Este estudo ensina uma escolha de engenharia, não um slogan de “mais alta tecnologia” sem critério.

## 7.11 Atualização da pesquisa

Registre data, URL efetivamente aberta, versão e afirmação apoiada. Links, produtos e APIs podem mudar; preços e disponibilidade exigem consulta no momento da decisão. Quando a fonte deixar de responder, marque a limitação e procure sua migração oficial. Preserve o baseline anterior para comparar o que mudou.

As sínteses deste capítulo são curtas; o detalhamento de implementação é original e fundamentado no nosso código. Não copiamos prompts privados ou grandes trechos de documentação externa.

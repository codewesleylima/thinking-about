# Análise do estudo e definição da WZZY AI

Fonte primária do projeto: [Agentes de inteligência artificial no terminal](../estudo_agentes_ia_cli_arquitetura_implementacao_validacao.md), fornecido na raiz, com 32 seções. O arquivo foi preservado sem alterações. Esta análise usa as distinções DOC, CODE, PAPER, LAB e DESIGN adotadas pelo autor. Não refaz nem certifica toda a auditoria dos repositórios citados pelo estudo.

## O que o documento estabelece

O documento é uma revisão técnica acompanhada de inspeção de código e um laboratório determinístico. Sua conclusão central, nas seções 1, 3 e 19.6, é que um agente de programação pode ser construído compondo um LLM existente com um controlador, ferramentas, política, contexto e avaliação. O modelo prediz saídas e propostas; o software concede autoridade e aplica efeitos.

As equações de Transformers, treinamento supervisionado, preferências e atenção explicam a camada do modelo. Não constituem uma receita de pré-treinamento economicamente dimensionada para este repositório. Da mesma forma, o laboratório de 22 testes descrito na seção 25 testa mecanismos delimitados; não demonstra competência geral de programação nem paridade comercial. Seus resultados pertencem ao estudo e não são os testes da implementação WZZY.

As seções 21–24 definem uma arquitetura implementável e uma sequência incremental. As seções 26–28 exigem que qualidade seja medida com tarefas, critérios, ambiente e orçamento controlados. A separação entre resultado narrado e evidência externa guia a implementação.

## Decisão de produto

**WZZY AI 0.1.0 é um agente CLI próprio, com inferência substituível.** O nome identifica nosso produto e sua orquestração; não renomeia os pesos de um fornecedor. Há um caminho local com Ollama e um caminho por OpenAI Responses. O modelo não é escolhido silenciosamente: o operador informa um identificador acessível em sua instalação/conta.

Essa escolha permite investigar o efeito do harness sem assumir custo de coleta de corpus, pré-treinamento, clusters, licenciamento, alinhamento e serving de pesos próprios. Um modelo próprio exigiria outro projeto experimental: direitos dos dados, orçamento computacional, baseline, split por origem, holdout, controle de contaminação, treinamento e avaliação. Fine-tuning só entra quando falhas recorrentes forem atribuídas ao comportamento do modelo e houver exemplos autorizados suficientes.

## Rastreabilidade

| Requisito científico | Implementação | Evidência ou limite |
|---|---|---|
| Separar proposta de execução, §1/21 | `agent.js`, `tools.js`, `workspace.js` | Testes de política e ferramentas desconhecidas |
| Integrar modelo, §19/23 | `providers.js` | Contratos HTTP simulados; smoke real opt-in |
| Preservar revisão, §13/21 | SHA-256, ocorrência única e gravação temporária | Conflito humano, CRLF, replacement literal |
| Isolar execução, §9/14 | Snapshot filtrado + Docker restrito | Bateria real separada dos testes com executor simulado |
| Limites e custo, §17/20 | Reservas inteiras, chamadas, prazo, bytes e repetição | Uso desconhecido conserva reserva; estimativa não é teto bancário |
| Memória e retomada, §11/17 | Transcript e checkpoints JSONL encadeados | Sem replay automático de ferramenta pendente/incerta |
| Conclusão verificável, §16/22 | Evidência de comando vinculada à revisão | `checks_passed` não implica cobertura total do pedido |
| Esclarecimento, §10/22 | `ask_user`, `waiting_user`, `resume` | Retomada conserva limites e permissões |
| Avaliação, §26/27 | Manifesto, controles positivos/negativos, hashes e relatório | Offline não estima qualidade de LLM |
| Configuração explícita, §8 | JSON validado, flags humanas, WZZY.md | Regras textuais não ampliam capacidades |

## O que foi adaptado

O estudo não exige Python, um SDK específico nem microsserviços. Node.js 24 foi escolhido porque já está disponível no ambiente e fornece CLI, HTTP, processos, testes, hashing e filesystem sem dependências de terceiros. Fronteiras ficam em módulos, permitindo substituir provedores e testar falhas por injeção de adaptadores.

O documento propõe compactação sofisticada, equipes de agentes e integração MCP como evoluções. Esta versão usa um agente, busca literal e interrupção explícita no teto de contexto. Isso mantém os limites compreensíveis enquanto se coleta evidência para justificar complexidade adicional. Não há ferramenta de publicação, envio de mensagens nem provisionamento de nuvem.

Preços e identificadores do estudo são uma fotografia, não configuração permanente. A aplicação exige seleção explícita do modelo e preços com fonte/data para chamadas pagas. Os contratos de [function calling OpenAI](https://developers.openai.com/api/docs/guides/function-calling) e [ferramentas Ollama](https://docs.ollama.com/capabilities/tool-calling) foram consultados na implementação em 20/10/2026. Disponibilidade de modelo depende da conta e do servidor.

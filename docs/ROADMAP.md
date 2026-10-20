# Estado do produto e evolução

## Versão 0.1.0 implementada

CLI `init`, `doctor`, `demo`, `run`, `chat`, `resume`, `sessions` e `inspect`; eventos JSONL; modelos via Ollama e OpenAI Responses; busca literal, leitura por linhas, criação e substituição com integridade; política de leitura/escrita/execução; snapshots somente leitura em Docker; cancelamento, limites, orçamento com reserva, detecção de repetição e journal encadeado; perguntas e retomada conservadora; suíte automatizada, manifesto e CI.

A execução offline é funcional. Inferência depende de modelo instalado ou credencial disponível. Testes de integração com simuladores não constituem execução real de provedor; o relatório registra essa diferença.

## Próximos marcos e critérios

| Marco | Por que e quando | Critério de aceite |
|---|---|---|
| Piloto com LLM real | Medir capacidade antes de otimizar | Tarefas representativas, múltiplas tentativas, falhas publicadas e gasto reconciliado |
| Recuperação estrutural/LSP | Busca literal insuficiente em projetos maiores | Ganho pareado em localização de consumidores e correção entre arquivos |
| Compactação validada | Tarefas excedem teto de contexto | Preservar contrato, autoridade, restrições, evidências e efeitos incertos em testes adversariais |
| Retomada transacional avançada | Recuperar sem abandonar sessões incertas | Idempotência e consulta de estado por ferramenta, crash em pontos do protocolo sem duplicação |
| Catálogo de preços/modelos | Vários perfis e faixas de cobrança | Fonte, vigência, capacidades, tokenizador validado e reconciliação financeira |
| Autenticidade de logs | Operação compartilhada/auditoria | Assinatura ou armazenamento externo com retenção e controle de acesso |
| MCP e editor | Necessidade concreta de ferramenta/IDE | Revisão de protocolo fixada, autenticação, capacidades restritas e regressões de política |
| Revisão/subagentes | Gargalo mensurável e tarefas independentes | Escopos separados, reserva global, conflitos controlados e ganho superior ao custo |
| Fine-tuning | Falha de comportamento recorrente com dataset autorizado | Baseline, holdout por origem, licença/dados documentados e ganho reproduzível |
| Pesos próprios | Objetivo de pesquisa e orçamento específico | Plano de dados, compute, arquitetura, treinamento e avaliação independente |

Esses marcos não estão ativados nem simulados como recursos existentes. Priorizar conforme métricas do piloto, seguindo a sequência incremental das seções 24 e 30 do estudo.

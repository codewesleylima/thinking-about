# 6. Avaliação, evidência e evolução do agente

## 6.1 Uma implementação precisa demonstrar o quê?

Separe três perguntas. O controlador aplica seus invariantes? O modelo escolhe ações úteis? O produto resolve tarefas reais de forma aceitável? Testes de schema respondem à primeira; trajetórias com inferência ajudam na segunda; um conjunto representativo com critérios externos responde à terceira.

O [estudo original, seções 25–28](../../estudo_agentes_ia_cli_arquitetura_implementacao_validacao.md) propõe laboratório, campanha e interpretação estatística. Esta edição mantém essa separação. Um requisito marcado `implemented` na especificação é uma afirmação de presença de mecanismo e referência de testes, não uma taxa de resolução comercial.

## 6.2 Baselines que não podem ser misturados

| Baseline | Como obter | O que sustenta |
| --- | --- | --- |
| Determinístico | Provedor controlado, falha injetada e estado verificado | Regras do controlador e recuperação de condições conhecidas. |
| Transporte real | Consulta HTTPS ou processo real de shell com saída observada | Ligação a infraestrutura específica, naquele ambiente. |
| Modelo real | Conta autorizada, ID resolvido e trajetória registrada | Integração e comportamento naquela tarefa. |
| Produto | Projetos e tarefas independentes com critérios congelados | Estimativa de utilidade para aquela distribuição. |

Os registros históricos 0.3.0 incluem uma equipe pequena com modelo real e uma consulta Java HTTPS real. Eles não são automaticamente evidência de que todo novo fork ou toda alteração 0.4.0 conserva qualidade. Reexecute verificações afetadas e registre o resultado da própria versão.

## 6.3 Campanha mínima para o destino

Prepare tarefas com snapshots e ambiente definidos. Inclua localizar código, bug de fronteira, contrato entre arquivos, dependência ausente, pergunta de negócio, conflito humano, conteúdo malicioso, timeout, saída excessiva, retomada e uso de shell quando autorizado. Uma solução de referência ajuda a detectar tarefa inviável ou avaliador incorreto.

Congele configuração candidata antes do holdout. Separe por projeto/família de bug para evitar versões quase idênticas no desenvolvimento e teste final. Registre todas as tentativas, falhas e gastos, não só a melhor resposta. Se ajustar o produto após olhar o holdout, ele passa a ser informação de desenvolvimento.

Comece com poucos casos para depuração do sistema e aumente diversidade antes de estimar qualidade geral. Um número arbitrário de tarefas não produz automaticamente independência ou representatividade. Para avaliar equipe versus agente único, mantenha mesmo teto total e ambiente equivalente.

## 6.4 Critério de sucesso

Uma definição operacional útil é:

```text
sucesso = requisitos funcionais atendidos
       E ausência de regressão detectada
       E restrições respeitadas
       E integridade da avaliação preservada
```

Não significa prova de ausência de todos os bugs. Um patch que funciona depois de ler um segredo proibido não é sucesso total. Um bloqueio de política correto pode ser conformidade de segurança, mas não resolução da tarefa de programação. Registre as duas dimensões.

## 6.5 Métricas úteis

| Métrica | Cálculo/observação | Cuidado |
| --- | --- | --- |
| Sucesso por tarefa | Tarefas que satisfazem todos os critérios / tarefas válidas | Publicar estratos e incerteza. |
| Custo por solução | Todo gasto / soluções válidas | Inclui falhas, revisores e retries. |
| Latência | Tempo até evidência útil e até resultado | Comparar também inicialização e espera humana. |
| Alegação sem suporte | Afirmação final sem evidência correspondente | Requer rubrica e revisão consistente. |
| Regressão | Quebra detectada de contrato anterior | Depende da cobertura de testes. |
| Recuperação | Falhas após as quais volta a haver progresso útil | Não confundir repetição com recuperação. |
| Autoridade | Efeitos fora da concessão efetiva | Shell host tem uma concessão distinta. |
| Eficiência de contexto | Informação útil recuperada por bytes/chamada | Mais tokens não significam melhor evidência. |
| Autonomia útil | Trabalho concluído e tempo de intervenção | Pergunta necessária não é falha. |

Para uma taxa binomial observada, use intervalo apropriado e declare hipóteses de independência. Várias tentativas no mesmo projeto não multiplicam diversidade como tarefas de projetos distintos. Não calcule confiança estatística de qualidade de LLM a partir de oito cenários determinísticos escolhidos.

## 6.6 Gates de liberação

**Gate A — contratos:** schema, política, paths, hashes, reservas, correlação, eventos e estados. Falha aqui bloqueia a versão.

**Gate B — execução:** processo travado, timeout, cancelamento, pipes, saída, limpeza incerta, daemon indisponível e ferramenta inexistente. O controlador precisa encerrar de forma diagnosticável, não repetir cegamente.

**Gate C — transferência:** gerar réplica em pasta nova, conferir exclusões e manifesto, executar demo e check no destino e testar pacote extraído. O checkout não pode esconder um arquivo ausente do pacote.

**Gate D — integração real:** modelo/conta disponíveis, leitura e outra ação mínima pertinentes. Registre ID e uso/modalidade. Uma falha por quota ou ambiente permanece falha do ensaio, sem ser escondida pelo mock.

**Gate E — qualidade:** holdout, critérios de domínio, regressão e custo. Uma capacidade só deve ser anunciada na amplitude sustentada pelo conjunto observado.

Os gates não exigem repetir testes caros sem mudança relevante. Rode o que comprova o contrato alterado, a suíte obrigatória e o artefato final. Publicação, deploy ou mensagens externas continuam dependendo da autorização de tarefa correspondente.

## 6.7 Quando adicionar tecnologia nova

| Gargalo observado | Extensão candidata | Critério antes de anunciar |
| --- | --- | --- |
| Busca literal perde consumidores | AST/LSP/índice | Acerto em símbolos e atualização de revisão mensurados. |
| Reinício perde fase de trabalho | Workflow durável/checkpointer | Reconciliação de efeito, não apenas reexecução de função. |
| Contexto perde requisito | Memória estruturada/semântica | Proveniência, correção, expiração e avaliação de perda. |
| Ferramentas remotas necessárias | MCP ou API específica | Autenticação, escopo, cancelamento, egress e testes adversariais. |
| Trabalho independente domina tempo | Concorrência | Reserva atômica, isolamento, conflito e custo global. |
| Diagnóstico de operação difícil | Telemetria externa | Convenções fixadas, correlação e redação de dados sensíveis. |
| Shell do host amplo demais | Sandbox/VM/worker | Enforcement real e ensaios de evasão apropriados. |

Uma biblioteca madura pode economizar implementação, mas cria dependências e semânticas que precisam ser entendidas. Adote a menor abstração que resolve o gargalo mensurado. Não adicione toda a pilha de tendências de uma vez.

## 6.8 Backlog técnico explícito

R24–R29 são planejados: recuperação estrutural, MCP, execução durável, concorrência, memória semântica e telemetria externa. R23/R30 são parciais: há perfis/receitas e alguns ensaios, mas falta automação completa do domínio Java e avaliação de qualidade geral.

Para cada extensão, escreva entrada, efeito, política, credenciais, falhas, estado persistido, cleanup e critério. Implemente uma fatia vertical e compare com o baseline. Não deixe um checkbox de documentação substituir o código ou o experimento.

## 6.9 Como registrar resultados

Registre data, plataforma, Node/toolchain, versão do runtime, configuração sem segredos, modelo resolvido, snapshots/digests, task ID, tentativas, gasto/cota, trajetória, estado e limitações. Journals locais podem conter código e dados: publique apenas artefatos preparados para compartilhamento.

O [registro de validação do projeto](../VALIDACAO.md) preserva épocas distintas. Uma réplica deve criar seu próprio registro e não importar a taxa de sucesso da origem como resultado local. Hashes e manifestos tornam a comparação rastreável, mas não substituem execução.

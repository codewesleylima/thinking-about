# 8. Matriz das 32 seções: pesquisa → construção → evidência

Esta matriz liga o [estudo original](../../estudo_agentes_ia_cli_arquitetura_implementacao_validacao.md) ao trabalho que outra implementação precisa realizar. Ela não significa que todas as propostas do estudo já foram automatizadas. Os IDs R01–R30 estão em [spec.json](spec.json); `planned` e `partial` devem permanecer visíveis no destino.

## 8.1 Cobertura por seção

| Seção original | O que o agente implementador deve fazer | Referência executável / ensino | Limite ou prova exigida |
| --- | --- | --- | --- |
| 1. Conclusões | Separar modelo, runtime, executor e avaliador; definir sucesso | R01/R15; capítulos 1 e 6 | Diagrama e caminho que não aceita autodeclaração de conclusão. |
| 2. Método | Registrar fato, observação, inferência e proposta com origem | Estudos preservados, manifesto upstream e validações | Uma fonte não prova execução no nosso ambiente. |
| 3. O que reproduzir | Definir produto e contratos, sem confundir com pesos | R01/R19/R21 | CLI funcional e limites explícitos; sem promessa de equivalência integral. |
| 4. Fundamentos | Compreender tokens, inferência, contexto e orçamento | [Modelo/harness](../codex/01-MODELO-E-HARNESS.md), R08 | Não tratar bytes como tokenização certificada nem perfis como treinamento. |
| 5. Ciclo/estado | Implementar transições e correlação de ações | `agent.js`, `journal.js`; R01/R06 | Teste de ferramenta pendente, pergunta e conclusão sem evidência. |
| 6. Produtos | Comparar funções e contratos relevantes à aplicação | Estudo histórico e [pesquisa atual](07-PESQUISA-ATUAL-E-FONTES.md) | Não transferir qualidade/preço de uma versão para outra. |
| 7. Código público | Fixar revisão, caminhos, hashes e licença antes de derivar | [Extração pública](../codex/08-EXTRACAO-DO-CODIGO-PUBLICO.md) | Arquivo ausente é registrado; código baixado não é executado por estudo. |
| 8. Instruções | Definir descoberta, persona, preferências e precedência | `profiles.js`, `specialists.js`, AGENTS/YZZY; R03/R16 | Instrução orienta; política concede. Guidance do runtime é apenas raiz. |
| 9. Guardrails | Fazer enforcement em ferramentas/ambiente e declarar confiança | `tools.js`, `workspace.js`, executores; R03/R07/R18/R20 | Modo host não herda confinamento do modo restrito. |
| 10. Planejar/perguntar | Inventariar, criar critérios, buscar informação e perguntar o essencial | R04/R12; capítulo 3 | Pergunta é evento de estado, não autorização implícita. |
| 11. Contexto/memória | Selecionar por relevância e preservar origem/restrições | `memory.js`, `learning.js`, `elevation.js`; R04/R13; R24 planejado, R28 parcial | Extrator e memória lexical com fontes existem; embeddings e avaliação pareada de ganho/perda pendentes. |
| 12. Ferramentas | Um catálogo canônico, validação local e executor correspondente | `tools.js`; R02/R18/R20; R25 planejado | Nome e schema não criam capacidade; cada efeito tem política. |
| 13. Edição | Ler, hash, substituir com integridade e criar exclusivamente | `workspace.js`; R05 | Conflito humano, BOM/CRLF, múltipla ocorrência e controle protegidos. |
| 14. Execução | Escolher ambiente, prazo, captura, cancelamento e cleanup | `executor.js`, `host-shell.js`; R07/R20 | Testar a árvore e reconhecer incerteza; nada de replay cego. |
| 15. Depuração | Reproduzir, formular hipótese e discriminar causas | `debugger`/`java`; R11/R23 | Receita e hipótese não equivalem a resultado observado. |
| 16. Alucinação/evidência | Vincular alegação a resultado e revisão | R15; estados do controlador | “Testou” exige execução real; host é diagnóstico. |
| 17. Loops/retomada | Persistir contadores e operações; interromper estagnação | `agent.js`, `journal.js`; R06/R14 | R26 durável é planejado; sem exactly-once genérico. |
| 18. Múltiplos agentes | Contratar consultas e reservar recursos agregados | `team.js`; R16/R17 | Sequencial e sem replay isolado; R27 paralelo é planejado. |
| 19. Modelo | Escolher por tarefa/capacidade/conta e validar protocolo | `providers.js`, adaptador Codex; R09/R10 | Catálogo/ID do ensaio não garantem disponibilidade futura. |
| 20. Custo/latência | Admitir antes de chamar, guardar saldo desconhecido e medir total | `budget.js`, `team.js`; R08/R17 | Codex usa cobrança do produto, não teto fictício em microUSD. |
| 21. Arquitetura | Implementar interfaces com direção de dependência e fronteiras | Capítulo 1; R01–R08 | Não transformar todo módulo em microsserviço sem necessidade. |
| 22. Contratos/prompts | Validar schemas, tarefa, decisão e resultado | Capítulos 2/3/5 e spec | JSON de exemplo só é contrato executável se validado pelo destino. |
| 23. Integração/interface | Adaptadores por API, CLI humano, JSONL e empacotamento | R09/R10/R19 | MCP/LSP não vêm automaticamente do adaptador ou de um perfil. |
| 24. Roteiro | Implementar fases na ordem e provar fatias verticais | [Construção](02-CONSTRUCAO-PASSO-A-PASSO.md) | Critério falho bloqueia ampliação; registrar dependências externas. |
| 25. Laboratório | Exercitar controlador com propostas controladas | `demo.js`, `evaluations/run.js`; R22 | Demo não mede qualidade do modelo. |
| 26. Avaliação completa | Criar tarefas, ambientes, holdout e graders de domínio | Capítulo 6; R30 parcial | Mais trabalho é necessário para estimar competência geral. |
| 27. Estatística | Definir unidade, amostragem, intervalos e comparação justa | Estudo original §27, capítulo 6 | Tentativas no mesmo caso não são tarefas independentes. |
| 28. Liberação | Validar pacote, réplica, controles e smokes pertinentes | R19/R21/R22, workflow CI | Artefato extraído precisa conter arquivos necessários. |
| 29. Java/AWS | Inventariar domínio, duplicação, transação e efeito externo | [Guia Java](../codex/05-JAVA-E-ENGENHARIA-REVERSA.md), R23 | Shell não autoriza produção; toolchain e conta continuam dependências. |
| 30. Decisões/erros | Evitar segurança só por prompt, excesso de agentes e métricas enganosas | Todos os gates e spec | Autonomia ampla exige um modo de confiança explícito. |
| 31. Glossário | Fixar significado de modelo, harness, evidência, revisão e efeito | Estudo original e capítulo 1 | Mesmo termo pode ter semântica diferente em outra API. |
| 32. Trilha de fontes | Preservar links, revisões, hashes, data e limites | `UPSTREAM.json`, fontes do estudo, capítulo 7 | Fonte primária e afirmação correspondente; sem inferir partes privadas. |

## 8.2 Como usar a matriz dentro do destino

Crie uma tabela local com as colunas requisito, módulo do destino, teste, execução, resultado, revisão e lacuna. Comece pelos requisitos sem dependências. Quando uma fase terminar, registre a execução correspondente e preserve resultados negativos.

Não marque R24–R29 concluídos apenas porque instalou uma biblioteca com a palavra “agent”. Um checkpointer precisa de semântica de efeito; um LSP precisa de atualização de revisão; MCP precisa de autenticação/escopo; concorrência precisa de reserva global. Use os critérios do JSON como início, refinando-os para a tarefa real.

Uma capacidade parcial pode continuar útil. Por exemplo, Java tem perfis detalhados e acesso a ferramentas do host quando autorizado, mas não possui um debugger embutido. Registre quais comandos e versões foram realmente usados, em vez de generalizar a partir do conhecimento descrito no prompt.

## 8.3 Comparar sem copiar nomes

Se a stack do destino usa classes em vez de funções, mantenha os mesmos contratos. `ModelGateway`, `AgentRunner` e `ToolPolicy` podem corresponder a `providers`, `agent` e `tools`. O nome não importa; importa que não exista um caminho alternativo em que a resposta do modelo execute um efeito sem validação.

Se o destino adota shell confiável, registre explicitamente a mudança da fronteira: os invariantes de leitura/escrita restritas continuam válidos para aquelas ferramentas, não para todo efeito possível do shell. Para isolamento global, implemente-o no sistema operacional/worker e valide essa afirmação separadamente.

## 8.4 Critério de ensino bem-sucedido

Um agente que seguiu este material deve conseguir explicar o que construiu, mostrar o caminho da mensagem ao efeito, reproduzir testes, identificar lacunas e apontar a fonte de cada decisão relevante. Ele não precisa alegar acesso aos pesos, ao raciocínio privado ou à infraestrutura interna do Codex.

O repositório de referência oferece contratos, código e artefatos. O destino produz sua própria evidência. Essa é a diferença entre copiar a aparência de uma ferramenta e construir uma implementação revisável.

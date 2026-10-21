# 8. Extração técnica do código público do Codex

## 8.1 Escopo e proveniência

Além de estudar documentação oficial, coletamos um recorte do repositório público [openai/codex](https://github.com/openai/codex) correspondente à versão consumida pelo projeto. O objetivo é compreender mecanismos, fixar evidências e construir uma implementação própria, preservando o limite entre harness público e modelo fechado.

| Identificador | Valor observado |
| --- | --- |
| Pacote usado | `@openai/codex@0.163.0` |
| Tag pública | `rust-v0.163.0` |
| Objeto da tag anotada | `129b8ec7ee6f4511557a4856279f529025c25af4` |
| Commit apontado | `83086188ae0614bd882818ff1aa23f3194962012` |
| Data de coleta | 21/10/2026 |
| Manifesto | [UPSTREAM.json](UPSTREAM.json) |
| Integridade local | SHA-256 de cada arquivo baixado, sem transformação |

Foram baixados quinze arquivos públicos selecionados, incluindo licença e NOTICE. O cache fica em `.yzzy/research/codex/<commit>/`, fora do catálogo de leitura das ferramentas do agente. Não executamos o código baixado nem incorporamos uma árvore completa upstream ao pacote. O manifesto e este estudo são versionáveis; o cache local pode ser regenerado.

## 8.2 Reproduzir a coleta

```bat
node scripts/study-codex-source.js --refresh
node scripts/study-codex-source.js --verify
```

O primeiro comando consulta a API pública do GitHub e baixa texto bruto da revisão fixada. Exige rede e pode estar sujeito a limites públicos de acesso. O segundo verifica somente os arquivos já presentes no cache, sem rede. Os atalhos npm são `study:codex` e `study:codex:verify` no checkout; o script de estudo não é uma ferramenta exposta ao modelo nem um comando necessário à instalação do CLI empacotado.

A lista de caminhos é explícita. O script registra arquivos ausentes, em vez de inventar seu conteúdo. Três caminhos de layouts antigos não existem nessa revisão: `core/src/codex.rs`, `core/src/project_doc.rs` e `core/src/skills/mod.rs`. A busca pela árvore real mostrou a reorganização; o ciclo principal desta coleta está em `core/src/session/turn.rs`. Essa diferença demonstra por que um tutorial de outra época precisa ser confrontado com a versão instalada.

O manifesto captura hashes do download; não verifica assinatura criptográfica do mantenedor nem garante por si uma build reproduzível do binário distribuído no npm. Tag, commit, fonte Rust e artefato nativo são identidades relacionadas, mas não uma prova de igualdade binária. Nossa evidência de compatibilidade continua incluindo os schemas e testes do executável instalado.

## 8.3 Mapa de leitura orientado por perguntas

Todos os caminhos abaixo são relativos ao [commit fixado](https://github.com/openai/codex/tree/83086188ae0614bd882818ff1aa23f3194962012). As descrições resumem a leitura dos módulos indicados, sem afirmar auditoria integral de seus milhares de caminhos possíveis.

| Pergunta | Arquivo público inspecionado | O que procurar | Correspondência YZZY |
| --- | --- | --- | --- |
| Como um cliente conversa com o runtime? | `codex-rs/app-server/README.md` | Inicialização, threads, turnos, notificações e pedidos do servidor. | `codex-rpc.js` e `codex-provider.js`. |
| Como o modelo alterna resposta e ferramenta? | `codex-rs/core/src/session/turn.rs` | `run_turn`, sampling, interpretação de eventos e continuação. | Loop de `runAgent`. |
| Quem mantém a sessão? | `codex-rs/core/src/session/session.rs` | Estado e serviços usados pelos turnos. | Estado próprio e journal. |
| Como ferramentas são expostas e encaminhadas? | `codex-rs/core/src/tools/router.rs` | Registro, exposição ao modelo e roteamento. | Catálogo/schema fechado em `tools.js`. |
| Onde entram aprovação e sandbox? | `codex-rs/core/src/tools/orchestrator.rs` | Requisitos, estratégia de execução e decisões. | `decide`, `Workspace` e executor Docker. |
| Como opções de execução são compostas? | `codex-rs/core/src/config/mod.rs` | Configuração efetiva, políticas e defaults. | Configuração estrita de `config.js`. |
| Como o histórico pode ser compactado? | `codex-rs/core/src/compact.rs` | Histórico substituto e metadados de checkpoint. | Projeção extrativa, com transcript preservado. |
| Como agentes são administrados? | `codex-rs/core/src/agent/control.rs` | Controle, comunicação, lifecycle e módulos de orçamento. | Equipe sequencial em `team.js`. |
| Como instruções globais são carregadas? | `codex-rs/codex-home/src/instructions/mod.rs` | Arquivos candidatos, leitura e estado de falha. | Orientação de raiz `YZZY.md`, sem copiar toda a descoberta upstream. |
| De onde vêm instruções do modelo? | `codex-rs/prompts/src/model_instructions.rs` | Template capturado dos metadados do modelo. | Base própria + instruções do perfil no adaptador. |
| Como permissões são comunicadas em texto? | `codex-rs/prompts/src/permissions_instructions.rs` | Construção de fragmentos de instrução. | Concessões efetivas comunicadas pelo nosso sistema. |
| Como o modo multiagente aparece no contexto? | `codex-rs/prompts/src/multi_agent_instructions.rs` | Composição de instruções conforme modo. | Contrato próprio de consultas e coordenação. |

## 8.4 Ciclo de inferência: o princípio extraído

`run_turn` trata a geração como parte de um processo com estado, não como uma única chamada de texto. Uma resposta pode terminar a interação ou produzir trabalho adicional. Para o nosso controlador, isso se torna um contrato pequeno:

```text
contexto validado -> geração -> proposta íntegra
    se houver ferramenta: autorizar -> executar -> registrar -> continuar
    caso contrário: calcular estado final -> registrar -> retornar
```

Essa é uma descrição original do padrão observado. Nossa implementação recebe propostas do Codex em JSON, preservando execução de ferramentas no host YZZY. Não reutilizamos todo o fluxo nativo de ferramentas de `run_turn`; ele existe no binário, mas o adaptador o restringe a inferência. Fonte específica: [session/turn.rs](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/session/turn.rs).

## 8.5 Ferramentas: contrato e mecanismo separados

O router público distingue o registro executável das superfícies apresentadas ao modelo. A lição de engenharia é manter a descrição da capacidade coerente com quem a executa. No YZZY, o mesmo catálogo alimenta o schema oferecido ao modelo e a validação local. A existência de uma string de nome não cria uma implementação.

O módulo upstream de orquestração reúne decisões de aprovação e sandbox com semântica de tentativa. Nossa versão deliberadamente usa uma política menor: não existe escalada automática, shell livre ou repetição de efeitos incertos. Essa redução é um design próprio para o primeiro produto, não uma cópia completa do sistema de aprovação do Codex. Fontes: [router.rs](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/tools/router.rs) e [orchestrator.rs](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/tools/orchestrator.rs).

## 8.6 Instruções: fatos de runtime e comportamento

O código público de instruções do modelo usa templates obtidos dos metadados capturados. Portanto, encontrar código aberto de montagem de mensagens não permite concluir que um único arquivo local contenha o comportamento completo de toda instância do serviço. Configuração, versão, modelo, ambiente e instruções adicionais influenciam a solicitação final.

O módulo de permissões compõe texto a partir de fatos de execução. A lição para nós é mostrar ao modelo suas concessões **reais**; esse texto precisa concordar com o enforcement. Se o sistema disser “pode editar”, mas o host negar, a interação se degrada. Se o texto disser “não pode” e o host permitir, o prompt sozinho não impede o efeito.

No YZZY, `personaInstructions` orienta conversa, `SYSTEM` define o protocolo de engenharia e o host informa permissões/recursos restantes. Ferramentas e políticas seguem sendo responsáveis pelas decisões executáveis. Fontes: [model_instructions.rs](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/prompts/src/model_instructions.rs) e [permissions_instructions.rs](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/prompts/src/permissions_instructions.rs).

O loader global consultado trata arquivos candidatos, ausência e falhas de atualização. Isso inspira diferenciar “não existe” de “não pude ler”, mas não copiamos sua política integral. Nosso fallback opcional continua restrito a ENOENT e erros de formato/acesso continuam visíveis. Fonte: [instruções do Codex home](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/codex-home/src/instructions/mod.rs).

## 8.7 Memória e agentes: o que adaptamos

O código público de compactação mantém metadados e constrói um histórico substituto. Isso mostra que memória operacional envolve seleção e persistência, além de texto de resumo. Nossa alternativa inicial é mais simples: extração local, referências de evidência e blocos recentes, sem apagar o transcript. Não afirmamos equivalência ao algoritmo ou qualidade da compactação remota. Fonte: [compact.rs](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/compact.rs).

O controle público de agentes expõe um sistema maior de lifecycle e comunicação. Nosso primeiro recorte separa consultas em sessões, conserva autoria e entrega ao coordenador. Não implementa toda a árvore, mailbox, concorrência ou retomada upstream. O orçamento agregado e o bloqueio da retomada isolada são decisões testadas do YZZY para o seu fluxo sequencial. Fonte: [agent/control.rs](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/agent/control.rs).

## 8.8 Licença e preservação de origem

O recorte inclui o [LICENSE](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/LICENSE) e o [NOTICE](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/NOTICE) do upstream. O arquivo de licença consultado declara Apache License 2.0. Esses documentos devem acompanhar qualquer decisão de redistribuir ou modificar código copiado; a classificação de todo o nosso produto não é alterada automaticamente por um estudo ou por consumir uma dependência. O pacote YZZY conserva sua licença declarada atual.

O estudo apresenta sínteses e código próprio. Não fazemos passar um arquivo upstream como autoria YZZY. Caso uma evolução incorpore código externo, registre arquivo, origem, revisão, licença, alterações e avisos no artefato distribuído. Leia também as condições e licenças de dependências transitivas antes de redistribuição específica.

## 8.9 Como outro projeto reproduz o método

1. Defina o problema e os critérios de sucesso antes de escolher ferramentas e número de agentes.
2. Fixe a versão da dependência e localize tag/commit, sem presumir que caminhos de um tutorial ainda existam.
3. Inspecione uma fatia vertical: entrada, contexto, geração, ferramenta, política, efeito, evidência e resposta.
4. Escreva contratos próprios pequenos e marque decisões que reduzem ou diferem do upstream.
5. Acrescente perfis com procedimentos concretos e evidência exigida; não só nomes de cargos.
6. Separe contexto de autoridade e faça enforcement fora do modelo.
7. Valide falhas e limites com testes determinísticos, depois avalie a qualidade com inferência real em tarefas independentes.
8. Documente o que não foi implementado e preserve a proveniência para revisar o estudo quando atualizar a versão.

Esse método permite aprender com o Codex público e construir um produto próprio sem prometer reconstruir componentes privados ou capacidades ainda não demonstradas.

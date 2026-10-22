# Estado do produto e evolução

## Versão 0.6.0 implementada

Autoevolução em worktree: `/elevar` estuda, modifica módulos permitidos, cria regressões, valida baseline/candidata e publica por Git quando aprovado. Pesquisa, implementação e uma correção compartilham orçamento. `/estudar` mantém memória sem edição. O publicador não altera pesos, dependências, controles congelados ou avaliadores originais. [Contrato e limitações](AUTOEVOLUCAO.md). Sandbox de verificações e avaliação pareada de ganho geral continuam como evolução futura.

## Versão 0.5.0 implementada

`/elevar` pesquisa documentação oficial pela ferramenta HTTPS, sintetiza lições com proveniência e persiste memória local entre sessões. Recuperação lexical, validade de 30 dias, consulta e remoção estão implementadas. O estudo recebe somente ferramentas de leitura e não altera os pesos ou código do agente. [Contratos e validação](APRENDIZADO-COM-ELEVAR.md). Embeddings, buscador geral, avaliação pareada de ganho e autodesenvolvimento com ativação/rollback continuam como evolução futura.

## Versão 0.4.0 implementada

Manual de construção com fases e matriz das 32 seções do estudo, especificação rastreável de 30 requisitos, entrada AGENTS/REPLICAR e gerador de base independente com manifesto. Shell CMD/sh do host é uma concessão opt-in, sem sandbox de filesystem/rede e com resultado diagnóstico. A validação inclui comandos reais, negação de readonly, limites, efeito incerto e geração executável de réplica. Veja [o manual](replicacao/README.md).

## Versão 0.3.0 implementada

Dezenove perfis internos, plano heurístico revisável, consultas sequenciais separadas e coordenação pelo host com orçamento agregado. Leitura de documentação HTTPS por autorização e allowlist, com DNS/endereço fixado, redirects, limites e proveniência. O [estudo detalhado](codex/README.md) inclui fontes públicas do Codex fixadas por commit, Java e engenharia reversa. Essas extensões não implementam colaboração nativa, concorrência, retomada transacional da equipe, debugger JVM, LSP ou busca aberta.

## Versão 0.2.0 implementada

CLI global `yzzy`, chat sem subcomando, login oficial e inferência Codex, catálogo de modelos, perfis internos/personalizados, preferências de dúvidas/tom/idioma/detalhamento, histórico, exportação, resumo e compactação extrativos. Mantém `init`, `doctor`, `demo`, `run`, `resume`, `sessions`, `inspect`, JSONL, backends Ollama/Responses, oito ferramentas, políticas, hashes, snapshots Docker, cancelamento, limites, detecção de repetição, journal e retomada conservadora. Recuperação de ENOENT não amplia autoridade. Instalação Windows inclui ajuste revisável do PATH do usuário.

A inferência real via Codex autenticado foi observada, incluindo leitura/edição e grader independente em Docker. O ledger financeiro pertence à API direta; a cota Codex é gerida pelo produto. Isso ainda não é benchmark de qualidade geral nem paridade com todas as funções de um CLI comercial.

## Próximos marcos e critérios

| Marco | Por que e quando | Critério de aceite |
|---|---|---|
| Piloto com LLM real | Medir capacidade antes de otimizar | Tarefas representativas, múltiplas tentativas, falhas publicadas e gasto reconciliado |
| Recuperação estrutural/LSP | Busca literal insuficiente em projetos maiores | Ganho pareado em localização de consumidores e correção entre arquivos |
| Memória semântica e avaliação ampliada | Complementar o extrator já implementado | Medir perda de informação e ganho pareado sem apagar autoridade/efeitos incertos |
| Retomada transacional avançada | Recuperar sem abandonar sessões incertas | Idempotência e consulta de estado por ferramenta, crash em pontos do protocolo sem duplicação |
| Catálogo de preços/modelos | Vários perfis e faixas de cobrança | Fonte, vigência, capacidades, tokenizador validado e reconciliação financeira |
| Autenticidade de logs | Operação compartilhada/auditoria | Assinatura ou armazenamento externo com retenção e controle de acesso |
| MCP e editor | Necessidade concreta de ferramenta/IDE | Revisão de protocolo fixada, autenticação, capacidades restritas e regressões de política |
| Equipes concorrentes e retomada | Evoluir o coordenador sequencial já implementado | Isolamento por escopo, reserva global atômica, recuperação de fases, conflitos controlados e ganho medido superior ao custo |
| Fine-tuning | Falha de comportamento recorrente com dataset autorizado | Baseline, holdout por origem, licença/dados documentados e ganho reproduzível |
| Pesos próprios | Objetivo de pesquisa e orçamento específico | Plano de dados, compute, arquitetura, treinamento e avaliação independente |

Esses marcos não estão ativados nem simulados como recursos existentes. Priorizar conforme métricas do piloto, seguindo a sequência incremental das seções 24 e 30 do estudo.

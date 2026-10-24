# Comparação reservada e isolamento da autoevolução

Contrato da versão 0.8.0. A entrega iniciada na 0.7.0 comprova uma melhoria delimitada antes de autopublicar e executa código candidato em ambiente isolado. Busca estrutural/LSP, debugger Java, contratos mais ricos entre especialistas e uma nova interface continuam como trabalhos separados.

## O que medimos

O avaliador mede componentes reais de memória e contexto do runtime. Não pergunta ao modelo se ele melhorou. Executa as funções de duas revisões sobre entradas iguais e compara os resultados com respostas esperadas calculadas pelo controlador. Não mede inteligência geral, qualidade de geração de código nem mudança dos pesos do GPT.

O perfil `memory-context-v2` possui 22 casos. Preserva os 12 contratos originais: recuperação por título, resumo, passos, verificação e limites; consulta irrelevante; lição vencida; origem revogada; orçamento insuficiente; separação entre aprendizado externo e instruções humanas; preservação de permissões/efeitos pendentes; preservação de referências de leitura. As lições são sintéticas e identificadas como tal, sem alegar pesquisa real.

Os dez casos adicionais verificam termos tardios em cada um dos seis campos, repetição de palavras que esconde termos posteriores, consulta parcialmente coberta nos campos adicionais, preservação do limite de tokens da consulta e recusa de uma lição longa vencida. Os campos gerados respeitam os tamanhos aceitos pelo armazenamento: o título permanece curto, com um tema longo antes dele; passos longos ficam abaixo de 800 bytes. Esses contratos foram definidos no núcleo antes da proposta do modelo; a candidata continua impedida de alterar o avaliador. A mudança aumenta a cobertura do comportamento esperado, sem reduzir os controles para obter aprovação.

`src/capability-evaluation.js` cria identificadores e termos aleatórios depois da implementação. O modelo conhece os contratos funcionais, mas não recebe as entradas reservadas nem o gabarito. O controlador grava entrada e gabarito em `.yzzy/evolutions/<id>/comparison-<tentativa>/`, fora da candidata. Consulte o caminho efetivo no relatório. Esses artefatos permitem reproduzir o ensaio; o hash da semente sozinho não reconstrói todos os identificadores.

Somente a entrada e uma cópia confiável de `evaluations/capability-probe.js` são montadas no contêiner. A sonda importa os módulos da revisão avaliada e devolve valores observados e duração. O controlador valida formato, quantidade e identidade dos resultados e compara cada valor ao gabarito privado. Campos como `passed` produzidos pelo código avaliado não concedem aprovação.

## Critério de publicação

Antes da pesquisa, `evaluateEvolutionBaseline` executa somente a revisão atual nos casos reservados, três vezes. Seu gabarito privado fica em `baseline-evaluation/`. A classificação usa valores observados: `evaluation_saturated` quando todos os casos passam; `evaluation_unstable` se o resultado varia; `insufficient_headroom` quando há menos casos corrigíveis que o ganho mínimo exigido. Esses estados encerram o fluxo sem inferência, edição ou publicação, com código de saída zero e explicação na interface. Não declaram evolução comprovada ou capacidade geral máxima. O relatório inclui `baselineEvaluation` e contadores zerados; limites e prazos de Docker continuam ativos.

Havendo margem, a pesquisa/implementação inicia. Depois são três execuções por revisão, alternando a ordem anterior/candidata em um novo conjunto reservado gerado após a proposta. Cada par usa exatamente a mesma entrada. A candidata precisa passar todos os testes/checks, corrigir pelo menos um caso em todas as repetições, não perder nenhum caso antes aprovado e não apresentar resultados instáveis. Resultado estável abaixo do ganho mínimo encerra como `no_measured_gain`, preservando candidata e relatório sem correção adicional. Uma rodada de reparação permanece disponível para falhas de check, regressão ou instabilidade, dentro do orçamento global; o reparador recebe diagnóstico geral sem o conjunto reservado.

O relatório registra os casos aprovados por repetição, ganhos, regressões, instabilidade, hashes dos snapshots e da entrada, imagem, duração e escopo. As comparações não fazem chamadas de modelo (`realModelCalls: 0`); pesquisa e implementação possuem sessões e consumo próprios. `durationMs` soma os tempos das funções observadas, sem incluir a inicialização dos contêineres. Não há limiar estatístico de desempenho ou estimativa monetária fictícia para o backend Codex.

Quando ambos os lados já passam todos os casos, este perfil não aprova outras mudanças. Para avaliar novas capacidades, o mantenedor deve desenvolver novos contratos e casos reservados no núcleo congelado, com controles negativos e revisão. Não deixe a candidata alterar seu próprio critério de aprovação. Aleatorização reduz acoplamento a exemplos, mas não prova ausência de manipulação nem substitui revisão semântica.

## Isolamento de execução

`src/evolution-sandbox.js` copia somente os arquivos autorizados para um snapshot temporário. Rejeita links, arquivos sensíveis e volumes excessivos. Não inclui `.git`, `.yzzy`, `.env`, dependências locais ou credenciais. O caminho exato `.env.example` é omitido mesmo quando rastreado: o template não é necessário aos checks. Outros nomes sensíveis continuam bloqueados, com o caminho no diagnóstico. Cada verificação e amostra roda em contêiner novo com código montado somente para leitura, rede desabilitada, raiz somente leitura, usuário 65534, todas as capabilities removidas e `no-new-privileges`. `/tmp` é temporário, com `noexec` e `nosuid`. Não monta socket Docker nem diretórios do usuário.

O padrão fixa imagem por digest, 1 GiB de memória, duas CPUs, 256 processos e 512 MiB temporários. A imagem completa Node inclui Git para fixtures locais dos testes; o Node continua sendo 24. A configuração `evolution` valida imagem, recursos, duas a cinco repetições e quantidade mínima de ganhos. Não há fallback para Node no host se Docker/imagem falharem. Timeout, truncamento, cancelamento, falha ou limpeza desconhecida impedem publicação. A remoção do contêiner usa um sinal independente do trabalho cancelado.

Git e o cliente Docker continuam sendo executados pelo controlador confiável no host. Inferência e pesquisa HTTPS autorizada acontecem fora do contêiner. O isolamento restringe o código avaliado; não isola o próprio daemon Docker nem elimina vulnerabilidades do kernel/engine. As escolhas seguem as opções documentadas de [execução de contêineres](https://docs.docker.com/engine/containers/run/) e [bind mounts](https://docs.docker.com/engine/storage/bind-mounts/).

## Preparação e reprodução

Instale e inicie Docker com contêineres Linux. Antes de usar `/elevar`, baixe a imagem fixada:

```text
docker pull node:24-bookworm@sha256:6449e19d8184d84062525b6a7524def03146c2cb04a7f08b076680d0e8e4240a
npm run test:evolution:docker
npm run test:evolution:checkout
npm run test:capabilities:docker
npm run test:evolution:live
npm run test:evolution:current
```

O primeiro teste faz probes reais de UID, escrita negada, ausência de dados privados, capabilities, rede e timeout/limpeza. O segundo introduz um defeito deliberado em uma réplica e confirma, em Docker real, aprovação de ganho e bloqueio de regressão e empate. Não usa modelo. O terceiro exige backend autenticado: cria réplica e origem Git locais temporárias, pesquisa, pede uma implementação ao modelo, executa o pipeline completo e testa commit/push nessa origem de ensaio. Não publica essa fixture no GitHub. Resultados locais ficam em `.yzzy/self-improvement-smoke.json` e `.patch`. Testes unitários usam runners injetados explicitamente e não são prova de isolamento real.

## Como outra implementação deve replicar

`test:evolution:checkout` valida os três checks em Docker usando todos os caminhos rastreados do checkout real. Não usa modelo ou Git de publicação. Esse ensaio cobre diferenças entre o conteúdo do checkout e o pacote/réplica, incluindo o template `.env.example` que bloqueou uma execução real da 0.7.0 antes de inferência. A exclusão do template não altera a política de acesso às ferramentas.

O ensaio original registrado em `replicacao/VALIDACAO-0.7.0.json` partiu da implementação anterior real, sem preparar um defeito artificial. Como a melhoria já foi incorporada, novas execuções de `test:evolution:live` reconstroem esse defeito conhecido somente na réplica temporária, antes de criar a baseline Git: removem a ampliação da pontuação e seus testes específicos de campos adicionais/tardios. Depois desse ponto todos os testes da baseline ficam congelados. Esse replay mede funcionamento do pipeline sobre uma correção conhecida, sem contar como descoberta nova ou benchmark de generalização. Nunca remove testes do checkout de origem.

`test:evolution:current` copia o código atual sem reintroduzir defeitos nem remover testes. Antes de pedir uma melhoria, executa a pré-avaliação real. Se não houver margem, deve encerrar como saturado, sem inferência ou patch: repetir um benchmark concluído não cria uma nova capacidade. Melhorias em outros domínios exigem contratos adicionais revisados, e não aumento cego de orçamento. A cobertura continua finita e não equivale a uma medida de inteligência geral.

1. Defina contratos observáveis e casos de sucesso e recusa antes de liberar edição ao modelo.
2. Preserve uma revisão anterior imutável e congele avaliador, políticas e testes existentes.
3. Gere dados reservados após a proposta; mantenha o gabarito fora do alcance da candidata.
4. Execute ambas as revisões no mesmo ambiente restrito, com entradas iguais, ordem alternada e repetições.
5. Julgue os valores no controlador. Exija ganho estável, ausência de regressão e limpeza confirmada; registre também reprovações.
6. Associe evidência ao manifesto de conteúdo aprovado; revalide antes de integrar e publique somente esse hash, sem force.
7. Amplie o benchmark por trabalho revisado do mantenedor. Declare exatamente quais capacidades foram medidas e quais permanecem desconhecidas.

Módulos de referência: `src/self-improvement.js`, `src/evolution-sandbox.js`, `src/capability-evaluation.js`, `src/process-runner.js` e `evaluations/capability-probe.js`. Testes: `tests/self-improvement.test.js`, `tests/evolution-sandbox.test.js` e `tests/capability-evaluation.test.js`.

O manifesto da candidata é conferido antes e depois da cópia do snapshot, antes e depois dos checks, após a comparação e novamente antes de integrar. Aprovação do snapshot não autoriza publicar alterações posteriores. [Resultados observados, incluindo a tentativa reprovada](replicacao/VALIDACAO-0.7.0.json).

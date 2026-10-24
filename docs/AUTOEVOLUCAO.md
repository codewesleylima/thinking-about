# Autoevolução do runtime com `/elevar`

YZZY BLACK 0.7.2. O comando estuda um assunto de agentes de IA, implementa uma melhoria nos próprios módulos, executa verificações e publica a revisão pelo Git quando os controles passam. Antes da pesquisa, mede se o perfil de avaliação tem margem para comprovar ganho. O ciclo de memória sem alteração de código continua disponível em `/estudar`.

A versão 0.7.1 corrige o bloqueio do template rastreado `.env.example` na preparação do snapshot. Ele é omitido, sem liberar arquivos sensíveis. O teste `npm run test:evolution:checkout` verifica os três checks em Docker sobre o checkout Git real, além das réplicas. [Evidência da correção](replicacao/VALIDACAO-0.7.1.json).

A versão 0.7.2 evita gastar o orçamento de inferência quando o perfil já passa todos os casos e encerra empates sem reparação. [Diagnóstico e validação](replicacao/VALIDACAO-0.7.2.json). Uma melhoria fora da cobertura atual pode continuar sendo útil, mas precisa de novos critérios revisados para comprovar ganho; ampliar chamadas não resolve o teto do avaliador.

## Como usar

```text
yzzy
/elevar
/elevar melhorar recuperação de memória e explicar fontes usadas nas respostas
/estudar técnicas de compactação de contexto
```

Em automação: `yzzy elevar "melhorar seleção de memória" --json`. O resultado `self_improvement_result` informa status, commit, confirmação de push, relatório e caminho da candidata. O comando opera o checkout onde os módulos carregados da YZZY estão instalados, mesmo que o chat tenha sido aberto em outro projeto. A interface mostra esse diretório antes do trabalho. Não procura um repositório qualquer pelo diretório atual.

É necessário um checkout Git com branch ativa, árvore limpa, upstream `origin/<mesma-branch>` e HEAD igual à branch remota. Git, Node e Docker Linux precisam estar disponíveis, com a imagem fixada já baixada; o backend de inferência deve estar configurado e autenticado. A instalação global por junction existente aponta para o checkout de desenvolvimento. Uma instalação npm copiada sem `.git` não pode se autopublicar: execute a versão de um checkout de desenvolvimento.

Invocar `/elevar` autoriza esse fluxo específico: pesquisa, escrita na candidata, execução das três verificações em Docker e comparação reservada, commit e push na origem já configurada. Não é necessário `--allow-write` ou `--allow-host-shell`: o publicador é uma capacidade própria do controlador, e o modelo continua sem shell ou Git. Perfis somente leitura não podem iniciar autoevolução; eles podem usar `/estudar`.

Depois de uma publicação, reinicie o YZZY para carregar a nova revisão. O processo que conduziu o ciclo mantém os módulos e controles antigos em memória até encerrar. Não há recarga dinâmica de políticas no meio da execução.

## O que é melhorado

O alvo é o software que envolve o modelo: recuperação de conhecimento, seleção e compactação de contexto, apresentação, perfis e módulos auxiliares. Uma melhoria precisa modificar `src/` e acrescentar ao menos um teste novo. Um texto afirmando que o agente ficou melhor não produz commit. Sem diff concreto, o resultado é `no_changes`.

Isso é autoengenharia do agente por inferência e ferramentas. Não altera pesos remotos, não cria por si só um modelo fundamental e não instala automaticamente dependências. Os manifests npm, lockfiles, configuração, instruções de projeto e avaliadores permanecem congelados nesse ciclo. Mudanças nesse núcleo requerem trabalho de desenvolvimento separado.

O modelo deve estudar conceitos relevantes ao objetivo, confrontar a fonte com o código real e implementar uma mudança delimitada. Sem tema, usa o objetivo de melhoria das capacidades do agente CLI já estabelecido: investigação, memória com fontes, testes e validação. “Capacidade máxima” significa usar os recursos configurados em um trabalho completo, com prazo e orçamento partilhados. Não há medição de toda a capacidade intelectual de um modelo nem inferência ilimitada.

## Algoritmo e estados

1. Resolva o diretório real do runtime, valide identidade Git, limpeza e sincronismo com `origin` e adquira `.yzzy/evolution.lock`.
2. Crie uma branch `yzzy/evolve-<uuid>` e um worktree em `.yzzy/evolutions/<id>/candidate`. Preserve os bytes de referência e as regras de fim de linha do Git.
3. Liste arquivos rastreados e congele hashes dos controles e de todos os testes originais. Execute a baseline e a pré-avaliação de capacidades antes de estudar. Se os checks falharem, interrompa. Se o perfil estiver no teto, instável ou sem margem para o ganho mínimo configurado, encerre sem inferência, edição ou publicação. O gabarito permanece fora da candidata.
4. Pesquise com o ciclo de proveniência já implementado. Registre URLs, datas e versões observadas e recuse referências inventadas. Sem lições válidas, não inicie implementação.
5. Execute o perfil de programação com ferramentas de leitura e edição por hash, dentro da candidata. Fontes e lições permanecem dados não confiáveis. O modelo não recebe `run_command` nem `run_check`; as verificações serão escolhidas pelo host.
6. Examine o diff. Aceite somente módulos liberados em `src/`, documentação e testes novos. Exija mudança no runtime e teste de regressão novo. Recuse alteração dos controles ou dos testes originais.
7. Calcule manifesto de conteúdo/modo e execute as três verificações fixas. Elas precisam retornar zero, com saída íntegra, sem interrupção e com limpeza conhecida. O manifesto deve ser o mesmo ao terminar.
8. Compare base e candidata nos 12 casos reservados de memória/contexto, três repetições por revisão e gabarito fora do contêiner. Exija pelo menos um ganho estável sem regressão/instabilidade. Resultado estável abaixo do ganho mínimo encerra como `no_measured_gain`, sem nova inferência. Falhas de verificação, regressões ou instabilidade podem receber uma rodada de correção dentro do orçamento restante; a segunda reprovação interrompe o fluxo.
9. Sob lock do workspace original, revalide branch, HEAD e limpeza. Reconfira a candidata aprovada, faça commit dos caminhos exatos e verifique que hooks/commit não mudaram o conteúdo testado.
10. Integre pelo `git merge --ff-only`, publique o hash exato para `origin` sem force e confirme o hash remoto por `ls-remote`.

`published` significa commit integrado e hash remoto confirmado. `committed` é um checkpoint local anterior ao push. `push_unconfirmed` indica que a integração local ocorreu, mas o push ou sua confirmação não terminou como esperado; o commit permanece local. `integration_unconfirmed` indica interrupção na integração e exige inspeção de HEAD. Nenhum desses casos provoca reset, force-push ou repetição automática da publicação. `error`, `limited` e `cancelled` registram as demais interrupções. A candidata e o relatório ficam disponíveis; não há exclusão recursiva automática desses artefatos.

## Verificações do controlador

Os comandos são executados diretamente, sem shell e sem consultar scripts npm que a candidata pudesse substituir:

```text
node --test --test-concurrency=2
node scripts/check.js
node evaluations/run.js
```

O primeiro roda testes originais e novos. O segundo verifica sintaxe, JSON, especificação rastreável, hash do estudo preservado e lockfile da réplica. O terceiro executa cenários determinísticos do controlador. A baseline usa os mesmos comandos. A revisão só recebe `checks_passed`; nenhum desses comandos demonstra sozinho melhoria geral de inteligência.

As verificações executam somente em Docker: snapshot readonly sem Git/estado privado/credenciais, rede desabilitada, usuário sem privilégios e limites de recursos. Não há fallback para Node no host. O controlador usa Git e o cliente Docker no host. Consulte o [contrato completo de isolamento e comparação](AVALIACAO-COMPARATIVA.md).

Timeout, cancelamento, saída excessiva ou limpeza do contêiner desconhecida bloqueiam a publicação. A remoção do contêiner é tentada mesmo depois do cancelamento. Snapshots temporários são removidos após a avaliação; candidata Git e relatório permanecem para inspeção.

## Controles congelados

O publicador impede escrita nos arquivos congelados por meio do `Workspace` e confronta o diff e os hashes antes de publicar. Isso preserva diretamente os arquivos de políticas, acesso a arquivos, despacho de ferramentas, provedores/autenticação, executor, shell, journal, configuração, orçamento de base e mecanismo de publicação, além dos testes já presentes.

Os módulos protegidos explicitamente em `src/` são `agent`, `tools`, `workspace`, `config`, `budget`, `profiles`, `providers`, `codex-provider`, `codex-rpc`, `host-shell`, `executor`, `journal`, `identity`, `util`, `errors`, `self-improvement`, `elevation`, `process-runner`, `evolution-sandbox` e `capability-evaluation`. Os demais arquivos fora de `src/`, `docs/` e `tests/` também são congelados. Artefatos históricos `VALIDACAO-*.json` não podem ser reescritos pelo ciclo. Testes novos são permitidos; testes existentes não podem ser editados para acomodar uma regressão.

Essas restrições são controles executáveis, mas não uma prova semântica de segurança. Um módulo permitido pode introduzir comportamento ruim mesmo quando arquivos centrais e testes permanecem iguais. A suíte pode ter lacunas. Conserve casos adversariais e revisão de arquitetura no desenvolvimento do núcleo; não use a aprovação automática como atestado de correção universal.

## Orçamento, observabilidade e recuperação

Pesquisa, implementação e eventual correção compartilham os contadores de chamadas, ferramentas, gasto/valor retido e prazo da configuração do runtime. A pesquisa usa até um terço das chamadas configuradas, com teto de oito; a implementação usa o restante. Não se multiplica o orçamento abrindo novas sessões. O prazo inclui baseline, Git e verificações. A cota do backend Codex continua sendo gerida pelo produto autenticado; o host não promete um teto financeiro que esse backend não implementa.

O relatório `.yzzy/evolutions/<id>/report.json` contém comparações, hashes dos snapshots, imagem, casos aprovados, duração, base, branch, sessões, fontes, totais, verificações, diff por caminhos, manifesto aprovado, commit e confirmação de push. O journal de cada fase permanece na candidata. As lições de pesquisa desse ciclo ficam na candidata e no relatório; não são copiadas silenciosamente à memória privada de outro workspace. Para conhecimento reutilizável no projeto atual, use `/estudar`.

O lock da evolução impede dois publicadores simultâneos. O lock normal do workspace protege a integração em relação a outras sessões da YZZY. Edições humanas diretas continuam possíveis e são rechecadas antes da integração; não há garantia contra um processo externo malicioso que escreva no exato intervalo de uma operação de filesystem. Uma divergência conhecida cancela a integração. O fluxo não faz stash, merge de conflitos ou reset de mudanças humanas.

Se o processo for encerrado abruptamente, o lock pode permanecer. Confira PID, relatório, HEAD local/remoto e processos antes de remover o arquivo específico. Não remova o worktree ou sua metadata Git por exclusão improvisada. Mantenha a candidata até concluir a investigação e use as operações nativas de `git worktree` ao administrar sua retenção.

## Como replicar em outro agente

Separe um pesquisador, um implementador e um publicador determinístico como papéis do workflow; eles podem usar o mesmo modelo. O pesquisador produz dados com proveniência, o implementador propõe alterações e o host escolhe verificações e publicação. Não entregue um shell irrestrito ao modelo apenas para automatizar Git.

Defina a identidade do repositório alvo pela instalação do próprio runtime, autorize explicitamente a operação na interface e valide as condições Git antes de gastar inferência. Use uma candidata separada, congele controles e avaliadores originais e associe a aprovação a um manifesto de revisão. Revalide antes de integrar. Publique o hash aprovado, nunca um nome de branch que possa ter sido movido inadvertidamente entre teste e push.

Mantenha um ledger agregado entre fases e imponha limite para correções. Registre efeitos incertos e não tente resolvê-los por repetição cega. Distinga teste determinístico com provedor injetado, integração real com modelo e benchmark de qualidade. Os testes de referência estão em `tests/self-improvement.test.js`; o teste real está em `scripts/self-improvement-smoke.js`.

O [Cookbook oficial de melhoria de agentes](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop), consultado em 22/10/2026, inspira a ligação entre observações, alterações e avaliação. Nossa implementação usa Node nativo e Git, com contratos próprios. A versão 0.7 acrescenta a comparação reservada de componentes; benchmarks gerais com inferência e múltiplas tarefas continuam pendentes. Resultados históricos: [0.6.0](replicacao/VALIDACAO-0.6.0.json). Contrato atual: [avaliação comparativa](AVALIACAO-COMPARATIVA.md).

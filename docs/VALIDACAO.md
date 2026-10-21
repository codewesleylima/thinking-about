# Validação da YZZY BLACK

## 0.4.0: ensino replicável, gerador independente e CMD

Em **21/10/2026**, no Windows/Node v24.19.0, a suíte aprovou **98/98 testes**, sem ignorados. O check validou **55 módulos JavaScript**, configurações JSON e **30 requisitos rastreáveis**, incluindo dependências da especificação, referências locais e hash do estudo original. Os **8/8 cenários determinísticos** continuam conformes, sem inferência real. O [registro estruturado](replicacao/VALIDACAO-0.4.0.json) separa esses resultados.

O arquivo de Downloads indicado pelo usuário e o estudo preservado na raiz tiveram SHA-256 idêntico: `89ca3740bec8b30e3e171becd99c61fa034a994821822911e2ff213f525c0252`. O original não foi alterado. O [manual novo](replicacao/README.md) acrescenta contratos, fases e matriz das 32 seções, com pesquisa primária atual, sem anunciar recursos planejados como implementados.

O teste de replicação gerou pasta independente, personalizou pacote/alias, confirmou dependência Codex fixada e exclusão de dados locais, executou demo e especificação, e recusou sobrescrever um arquivo humano. O pacote npm foi extraído em pasta limpa e **gerou outra réplica**, cuja demo e check completo passaram. Um ensaio adicional da réplica também aprovou os 98 testes; a ausência inicial do lockfile no artefato foi diagnosticada e corrigida com um asset de resolução portátil e adaptação apenas da identidade raiz. O check final da réplica valida esse lock e o hash do estudo. Não houve instalação automática nem cópia de credenciais.

Os testes de CMD/sh executaram comandos reais de echo/redirecionamento/exit code em pastas temporárias. Cobriram capacidade separada, negação por readOnly e consulta de equipe, filtragem de variáveis conhecidas, limite de JSON, timeout/cancelamento, efeito incerto, ausência de avaliação independente e preservação de falha de check. A primeira espera infinita encontrou a limitação do runner restrito para encerrar descendentes: os três PIDs exatos do ensaio foram identificados e finalizados com autorização; as fixtures passaram a ser autolimitadas. O produto não alega limpeza absoluta de processos destacados ou serviços.

**Integração real com modelo:** sessão `5dc2fb3d-8e12-4cd0-9414-6ecd9582710b`, `gpt-6.1-sol` via Codex, duas chamadas e uma ferramenta. O modelo propôs `echo YZZY_SHELL_READY`, o CMD retornou essa saída com exit code 0 e o modelo a relatou. O estado foi `completed_unverified`, conforme o contrato diagnóstico. O ensaio restrito inicial não conseguiu acessar o estado oficial do Codex; a execução real ocorreu com a permissão de ambiente correspondente. Isso não alterou o default nem as concessões do produto.

`--allow-host-shell` permite comandos com privilégios do usuário, sem confinamento por paths/egress; as garantias do modo restrito não são generalizadas a ele. O ensaio de echo não demonstra construir qualquer software, depurar toda biblioteca ou ausência de falhas. Não houve novo build Java, debugger, LSP, MCP ou Docker real nesta rodada. Os limites estão em [CMD e execução](replicacao/05-CMD-E-EXECUCAO.md), [avaliação](replicacao/06-AVALIACAO-E-EVOLUCAO.md) e na especificação.

## 0.3.0: estudo público, especialistas, equipe e documentação HTTPS

Validação realizada em **21/10/2026**, Windows/Node v24.19.0. O [registro estruturado](codex/VALIDACAO-0.3.0.json) contém os identificadores dos ensaios reais; o [estudo detalhado](codex/README.md) diferencia implementação, receita e capacidade ausente.

- **90/90 testes aprovados**, sem ignorados; **49 módulos JavaScript** com sintaxe válida e configurações JSON válidas. São 12 testes novos sobre o baseline 78, cobrindo equipe, CLI e documentação.
- **8/8 cenários determinísticos** conformes. Esses cenários não fizeram inferência real e não medem qualidade do modelo.
- **15 arquivos públicos** do Codex foram coletados da tag 0.163.0, commit `83086188ae0614bd882818ff1aa23f3194962012`, e seus hashes de cache foram verificados. Não houve execução do código upstream baixado.
- **HTTPS real aprovado**: o transporte nativo consultou o manual Oracle `javap` do Java 25, retornou texto sem truncamento e produziu URL/data/hash; o resultado serializado ficou dentro do teto de saída. Esse teste não usa LLM.
- **Equipe real aprovada como integração**: `java`, `tester` e `orchestrator`, com `gpt-6.1-sol` resolvido pelo Codex, criaram três sessões separadas. Foram seis propostas de modelo e três leituras de `src/Sample.java` em aproximadamente 52 segundos. A amostra permaneceu intacta; não houve execução de comandos.

A amostra Java continha `twice(int x) { return x + 1; }`. O coordenador identificou incremento em vez de dobro, recomendou `2 * x` e propôs `x=2` como teste discriminante, observando que `x=1` não distinguiria as duas implementações. Também declarou que não executou testes. O estado correto foi `completed_unverified`, não `verified` nem `checks_passed`. O resultado demonstra o ciclo de leitura/parecer/síntese em uma tarefa pequena; não demonstra build, debugger, inspeção de JAR, performance ou competência geral em engenharia reversa.

O primeiro ensaio de integração reutilizou por engano o identificador de modelo da fixture offline e recebeu HTTP 400. O script foi corrigido para usar o padrão do Codex; a execução registrada acima foi feita após a correção. No ambiente restrito desta sessão, o processo oficial também exigiu acesso ao seu diretório de estado e rede; a validação real foi executada com a permissão correspondente. Nenhuma falha foi tratada como sucesso nem houve mudança das permissões do produto para fazê-la passar.

Foram encontradas e corrigidas três regressões durante a revisão: `/team` precisava conservar o perfil humano somente leitura; truncamento de documentação precisava considerar escapes do JSON final; cancelamento precisava interromper a espera por DNS pendente. Há casos executáveis para as três situações. Os controles anteriores de caminhos, hashes, segredos, execução e evidência continuam na suíte.

O pacote 0.3.0 foi extraído em diretório temporário e sua demonstração terminou com o avaliador independente da fixture em `verified`. Isso valida o artefato empacotado e o controlador da demo, não o modelo real. A instalação global existente foi inspecionada: o junction já aponta para este checkout. O verificador de PATH preservou a configuração existente e o comando instalado respondeu `YZZY BLACK 0.3.0`. Abra novo CMD e novas sessões após atualização do runtime.

Não houve novo teste de compilação Java ou Docker real nesta rodada; o executor existente não foi modificado. Java continua dependendo de imagem/caches/layout apropriados. A equipe é sequencial, não tem retomada transacional e não aceita retomada isolada de suas sessões. Consulta por URL permitida não é busca aberta. Resultados, comandos de reprodução e limites estão nos capítulos [4](codex/04-EQUIPE-E-ORQUESTRACAO.md), [5](codex/05-JAVA-E-ENGENHARIA-REVERSA.md) e [7](codex/07-PESQUISA-E-VALIDACAO.md).

Data: **20/10/2026**, America/Sao_Paulo. Ambiente local: Windows, Node.js **v24.19.0**, npm **11.17.0**, Docker Engine **29.6.1** com containers Linux.

Este registro descreve observações desta implementação. Os testes do laboratório do estudo original não foram reapresentados como resultados da YZZY BLACK.

## Baseline histórico 0.1.0, sob o nome WZZY AI

| Verificação | Resultado observado no baseline inicial |
|---|---|
| Suíte `node --test` | 43 testes aprovados; sem falhas ou testes ignorados |
| Sintaxe e JSON | 24 módulos JavaScript e arquivos JSON validados |
| Cenários determinísticos | 8/8 conformes, incluindo controle positivo e negativo |
| Demonstração da CLI | Corrigiu o limite de maioridade e passou no grader independente |
| Sessões | Listagem/inspeção, perguntas, retomada e limites persistentes exercitados |
| Concorrência e arquivo | Hash obsoleto rejeitado, alteração humana preservada, CRLF/BOM e replacement literal preservados |
| Política | Traversal, nomes reservados, symlink/junction, hardlink, segredos conhecidos e escrita sem concessão rejeitados |
| Adaptadores OpenAI/Ollama | Schemas, formatos, correlação, uso e falhas testados com respostas HTTP simuladas |
| Docker real | UID restrito, raiz/projeto somente leitura, ausência de credencial e arquivo `.env`, rede externa indisponível |
| Timeout Docker real | Processo e filho encerrados pela remoção do container; limpeza confirmada |
| Containers restantes | Nenhum container `yzzy-*` após a bateria real |
| Empacotamento | `npm pack --ignore-scripts`, extração em diretório temporário e execução da demo do pacote |
| Inferência com modelo real | Não executada: servidor Ollama/modelo e credencial de API ausentes no ambiente inicial |
| CI remoto em três sistemas | Configurado; não apresentado como execução observada localmente |

Imagem oficial utilizada, fixada na configuração e no CI:

```text
node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
```

Na bateria real com essa imagem, as sondas de filesystem/rede/identidade/credenciais terminaram com exit code 0 em aproximadamente 590 ms. O teste deliberadamente interminável, que também criou um filho, atingiu o prazo de 1000 ms; o cliente retornou em aproximadamente 1032 ms e o container foi removido. Esses tempos são observações da máquina, não SLA.

O acesso ao daemon foi validado em execução autorizada fora do sandbox do editor. Dentro do sandbox, `doctor` detectou corretamente erro de acesso ao pipe; isso não foi interpretado como falha no mecanismo Docker nem ocultado como integração aprovada.

## Como reproduzir

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test
npm.cmd run check
npm.cmd run evaluate
npm.cmd run test:docker
npm.cmd pack --ignore-scripts
npm.cmd run test:package
```

O digest deve estar preparado no Docker; consulte [configuração](CONFIGURACAO.md). `evaluations/results/latest.json` registra hashes dos módulos, schema, instrução e manifesto, plataforma e resultados. Novas execuções substituem esse relatório local ignorado pelo Git. A cadeia de eventos de cada fixture fica no diretório temporário impresso ou identificado no relatório.

## Limites da conclusão

No baseline inicial havia evidência do controlador, CLI, ferramentas, empacotamento e isolamento, sem inferência real. A evolução 0.2.0 abaixo acrescenta essa integração. Um smoke real ainda não demonstra qualidade geral de programação: é necessário ampliar tarefas, repetições e critérios independentes conforme [avaliação](AVALIACAO.md).

Não foi realizado pré-treinamento/fine-tuning, auditoria formal, benchmark competitivo, teste de carga multiusuário nem validação local de Linux/macOS. A versão é uma base funcional para piloto controlado. `checks_passed` significa que verificações cadastradas passaram na revisão observada; somente avaliação independente com critérios de tarefa pode sustentar uma alegação mais ampla.

## Evolução posterior: recuperação de ENOENT

A evolução do tratamento de arquivos ausentes foi validada separadamente do baseline acima, no mesmo ambiente Node.js v24.19.0:

- 51 testes aprovados, incluindo os 43 originais e 8 cenários adicionais de ausência, recuperação e limites de autoridade.
- 26 módulos JavaScript com sintaxe válida e configurações JSON válidas.
- Ausência opcional aplica fallback sem repetir a leitura; acesso negado, I/O e erro de formato não são ignorados.
- Uma sessão recebeu `ENOENT`, listou o workspace e leu o arquivo correto sem criar o caminho inicialmente ausente.
- `ENOENT` não concedeu escrita; a tentativa subsequente sem `--allow-write` foi negada.
- Configuração explicitamente selecionada e workspace ausentes produziram diagnóstico, sem criação silenciosa do destino.

Esses ensaios usam propostas roteirizadas e falhas controladas. Não demonstram que qualquer modelo localizará o arquivo correto, nem diagnosticam um erro de outro CLI sem o caminho e o contexto completos. O requisito de Node.js 24+ permanece. A bateria Docker histórica não foi contada como nova execução nesta alteração, que não modifica o executor.

## YZZY BLACK 0.2.0: inferência real e personalização

Entrega executada em 20/10/2026 no mesmo ambiente Windows/Node/Docker descrito acima. A mudança de nome preserva o estudo original, os controles de arquivo, autoridade, evidência e retomada. O runtime acrescenta Codex 0.163.0 como dependência fixada, perfis, preferências e memória extrativa.

| Ensaio | Resultado observado |
|---|---|
| Suíte automatizada | 63/63 aprovados, sem ignorados; inclui perfis restritos, preferências inválidas, identidade de retomada, correlação, compactação, protocolo e CLI/exportação |
| Sintaxe e configuração | 35 módulos JavaScript e arquivos JSON válidos |
| Cenários offline | 8/8 conformes; zero chamadas reais nesse runner |
| Conta Codex | Login ChatGPT reconhecido oficialmente; catálogo retornou modelos disponíveis |
| Inferência mínima real | `YZZY_READY`, modelo resolvido `gpt-6.1-sol`; uso reportado 7086 tokens de entrada e 45 de saída |
| Primeira tentativa real de edição | Falhou no critério: o modelo leu, mas interpretou sandbox nativo como proibição das ferramentas de escrita do host |
| Edição após correção das instruções | 3 propostas, 2 ferramentas (`read_file`, `replace_text`); alteração com hash aplicada; grader independente Docker aprovou 0, 17, 18, 19 e 99 |
| Status da sessão de edição | `completed_unverified`, pois não executou verificações no próprio ciclo; a aprovação externa foi reportada separadamente, sem promover o status por narrativa |
| Docker real repetido nesta versão | Sondas de filesystem/rede/UID/credenciais aprovadas; limpeza conhecida; timeout de 1000 ms encerrou processo/filho, resultado não aprovado |
| Tempos Docker observados | Sondas 6492 ms; timeout retornou em 1025 ms; não são SLA |
| Instalação Windows | npm global instalado; script de PATH revisável; `yzzy --version` retornou 0.2.0 |
| Chat instalado no CMD | Abriu sem subcomando, mostrou ajuda, respondeu e recuperou a palavra ORQUIDEA no turno seguinte; `/summary` preservou as duas instruções humanas; `/exit` encerrou com código 0 |
| Aceitação CLI em processos separados | Perfil personalizado `mentor` herdou somente leitura; `ask_user` suspendeu; duas retomadas preservaram a palavra ARARA e as três instruções humanas; 3 propostas reais, sem promoção de autoridade |

A falha inicial e seu ajuste não formam uma estimativa de sucesso: a instrução mudou entre condições. O ajuste explicitou as concessões do host e manteve o processo nativo em leitura. A sessão de edição bem-sucedida tem ID `e1e8ea19-ade4-4a40-bc58-7d0c72d50d92`; o transcript permaneceu no diretório temporário da fixture, fora do Git.

No Codex, `billing:managed_by_codex` não oferece reconciliação financeira local. O uso de tokens reportado na resposta mínima não mede o custo total do produto, nem garante a mesma contagem em outra execução. Não foram observados pesos próprios, treinamento, benchmark competitivo, auditoria formal ou execuções remotas de CI nesta entrega.

Para repetir, use os comandos offline acima, `npm.cmd run test:codex`, `npm.cmd run test:codex:edit` e `npm.cmd run test:codex:cli`. Os três últimos consomem cota real; o de edição requer Docker. O último verifica um perfil personalizado, uma pergunta e continuidade entre processos separados. Mantenha os resultados e as falhas da nova execução; não copie os números históricos como resultados do ambiente de destino.

## 0.2.1: apresentação do terminal e saudação em pasta grande

Validação em 21/10/2026, Windows e Node.js v24.19.0:

- O problema relatado foi reproduzido em teste controlado: uma pasta acima de `maxScanFiles` fazia a resposta simples falhar no snapshot final. A resposta agora termina sem revisão e em `completed_unverified`, inclusive após retomada. Uma evidência de teste existente ainda exige snapshot completo: se a pasta exceder o teto, não há aprovação. O limite não foi aumentado.
- 70 testes aprovados: 63 anteriores e 7 novos cobrindo a regressão, revisão obrigatória para evidência, saída humana sem JSON/UUID, controles de terminal não confiáveis, largura/cores, limpeza do indicador de atividade e aviso de cota em português.
- 38 módulos JavaScript com sintaxe válida e configurações JSON válidas; 8/8 cenários offline conformes.
- O comando instalado abriu a interface 0.2.1 no CMD, em `C:/Users/Guste`; cabeçalho, ajuda e prompt foram exercitados. A demonstração offline colorida também foi executada em terminal real, com leitura/edição, avaliação independente e término com código 0.
- A tentativa real com “ola” nesta rodada foi impedida pela mensagem de limite de uso do Codex. Isso valida a observação do bloqueio de infraestrutura, **não** uma resposta bem-sucedida do modelo nesta versão. O tratamento de cota em português foi testado com a falha controlada; não foram feitas chamadas repetidas para contornar o limite.

JSONL de automação e journal permanecem disponíveis; somente a apresentação humana omite eventos técnicos rotineiros. As versões antigas já abertas precisam ser encerradas com `/exit` e reabertas. O comando global ligado ao checkout carrega a nova versão ao iniciar. A mudança do hash do runtime continua exigindo nova sessão; históricos anteriores são preservados.

## 0.2.2: abertura cyber com globo rotativo

Em 21/10/2026, no mesmo ambiente Windows/Node, a suíte completa aprovou 74 testes e o check validou 39 módulos JavaScript. Os quatro cenários novos verificam cancelamento com restauração de cursor, globo estático sem controle de cursor em pipe/movimento desativado, conclusão dos redesenhos antes do prompt e interrupção ao redimensionar a janela.

A animação foi exercitada em um terminal real com cores, sem inferência: a textura geográfica gira sobre a esfera, o wordmark permanece fixo e, depois da volta inicial, aparece o prompt. `/exit` encerrou com código 0. O globo usa cálculo local; não representa uma conexão de rede ou estado de autenticação. Os testes não constituem nova avaliação de capacidade do modelo. A configuração de movimento, fallback e paleta está descrita em [configuração](CONFIGURACAO.md).

## 0.2.3: globo contínuo e mini globo de atividade

Suíte completa: 78/78 testes aprovados, sem ignorados. Sintaxe e JSON: 41 módulos JavaScript e configurações válidas, no mesmo ambiente Windows/Node descrito acima.

A interface passou a usar cabeçalho fixo animado, área rolável da conversa e rodapé de atividade. O globo principal continua após a abertura e durante mensagens/digitação. O mini globo usa uma projeção de 13×11 pontos compactada em 7×3 células Braille, com rotação independente ao lado do rótulo da ação. Parar a atividade preserva o timer do cabeçalho; fechar o chat remove os timers e restaura o terminal.

A validação inclui continuidade após resposta, mini globo no rodapé, resize preservando texto/cursor do readline, navegação PgUp/PgDn e remoção de listeners/restauração de margens e tela ao sair. No terminal Windows com cores, `/help` foi digitado em duas partes durante a rotação e interpretado corretamente; `/exit` encerrou com código 0. A prévia `npm.cmd run preview:terminal` exibiu os dois globos e a transição de atividade, sem inferência. Isso avalia a interface, sem medir novamente capacidade do LLM. Os fallbacks estáticos continuam cobertos.

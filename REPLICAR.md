# Ensinar outro agente a construir um sistema semelhante

**Extensão 0.6.0:** [Autoevolução](docs/AUTOEVOLUCAO.md) ensina o fluxo executável de pesquisa → edição dos próprios módulos → baseline e regressões → commit/push. O novo requisito R31 cobre alvo Git, candidata, orçamento agregado, controles congelados, publicação por hash e estados incertos. `/estudar` mantém o mecanismo de memória da 0.5.0.

**Extensão 0.5.0:** o guia [Aprendizado com `/elevar`](docs/APRENDIZADO-COM-ELEVAR.md) ensina estudo online, lições com fontes, memória entre sessões, expiração e remoção. Os módulos e testes já são incluídos pelo gerador de réplica; os aprendizados privados da origem não são copiados.

**Versão 0.4.0, 21/10/2026.** Este arquivo é a entrada curta. O detalhamento, as decisões e os critérios estão no [manual de replicação](docs/replicacao/README.md). O [estudo original](estudo_agentes_ia_cli_arquitetura_implementacao_validacao.md) permanece intacto; o [estudo do Codex](docs/codex/README.md) aprofunda a integração e Java.

## Para a IA que chegou a este repositório

Seu objetivo é construir um produto executável que conecte modelo, ferramentas, contexto, execução e verificação. Ler este repositório fornece exemplos e contratos; não modifica automaticamente os seus pesos e não concede privilégios no destino.

Comece identificando o pedido humano. Se ele quer um fork funcional, use a geração abaixo. Se quer uma implementação independente, siga as fases do manual e os requisitos de [spec.json](docs/replicacao/spec.json), adaptando a linguagem sem remover invariantes. Se ele quer somente documentação, não instale nem modifique aplicações externas.

## Caminho A: gerar uma base executável independente

O diretório pai deve existir e o destino deve ser **novo e fora da origem**. Nada é mesclado a um projeto existente.

```bat
yzzy replicate --output "C:/projetos/meu-agente" --name meu-agente --command meuai
cd /d "C:/projetos/meu-agente"
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test
npm.cmd run check
npm.cmd run evaluate
node bin/yzzy.js demo --json
npm.cmd install --global . --ignore-scripts --no-audit --no-fund
npm.cmd run install:cmd
meuai login
meuai
```

A geração copia fontes, ferramentas, especialistas, testes, avaliações e documentação, com manifesto de hashes. Não copia `.git`, `.yzzy`, `node_modules`, credenciais ou pesos. Não chama o modelo, não instala dependências nem executa comandos do novo projeto. O lockfile preserva as resoluções da referência e adapta somente nome/bin/versão da raiz. Revise e versione o lockfile do derivado.

O nome do pacote e o alias npm são personalizados. A identidade visual YZZY e os identificadores internos `.yzzy`, `YZZY_*` e protocolos são preservados deliberadamente. Para criar marca própria, use a lista de personalização no manual e reexecute os testes; a geração não faz um rename textual global arriscado. A licença declarada também é preservada, sem converter automaticamente o projeto em outra licença.

## Caminho B: construir por contratos na stack do destino

Copie este pedido para um agente autorizado no projeto de destino, substituindo os campos:

```text
Leia REPLICAR.md, docs/replicacao/README.md e docs/replicacao/spec.json
do repositório de referência YZZY BLACK. Nosso destino é <caminho>.
O comando desejado é <nome>, a stack é <linguagem ou detectar>,
o modelo/provedor é <conta autorizada ou informar lacuna>.

Inventarie o destino sem sobrescrever mudanças existentes.
Escreva um contrato de tarefa com requisitos e critérios verificáveis.
Implemente as fases em ordem: controlador e eventos; ferramentas e política;
edição por revisão; executor; modelo real; memória; equipe; embalagem e evals.
Para cada requisito da especificação, registre o módulo equivalente no destino,
o teste real e o status. Adapte nomes e interfaces, preserve os invariantes.
Não simule capacidades ausentes nem use demo como prova de qualidade do modelo.
Mantenha shell do host desabilitado até concessão humana explícita.
Entregue CLI funcional, documentos, comandos/resultados e lacunas observadas.
```

O texto é um contrato de trabalho, não uma garantia de conclusão para qualquer pedido. Há tarefas que dependem de credenciais, ferramentas, rede, dados, licenças, hardware e decisões humanas. Registre a dependência e avance no que já está autorizado.

## CMD e autonomia

No modo restrito, arquivos e verificações seguem as políticas existentes. Para uma sessão que possa usar o shell do host:

```bat
yzzy --agent java --allow-host-shell
yzzy team run "Investigue e corrija o build local autorizado" --specialists java,tester --allow-host-shell
```

Windows usa CMD; POSIX usa `sh`. A autorização permite comandos com pipes, redirecionamentos e programas instalados, sujeitos aos limites de tempo/saída do controlador e às permissões do sistema operacional. O processo não é confinado ao workspace e pode acessar rede pelo shell. O resultado é diagnóstico, sem promoção a verificação independente. Veja [o contrato de execução](docs/replicacao/05-CMD-E-EXECUCAO.md).

Não prometa “construir qualquer coisa”. Projete um sistema geral capaz de investigar, implementar, testar, reconhecer limites e pedir a informação indispensável. A confiança vem de evidência repetida, não da amplitude de uma promessa.


## Atualização 0.7.0: avaliar antes de autopublicar

A autoevolução exige verificações em Docker offline e readonly, mais ganho estável em casos reservados de memória/contexto, com três repetições por revisão. Empate, regressão ou limpeza incerta bloqueiam publicação. Git e inferência continuam no controlador. Esta atualização substitui descrições anteriores de verificações da autoevolução no host. Não implementa LSP, debugger Java ou benchmark geral de inteligência. Consulte [o contrato e o passo a passo](docs/AVALIACAO-COMPARATIVA.md).

# Estudo do Codex e equipe YZZY BLACK

**Extensão 0.4.0:** o [manual de replicação](../replicacao/README.md) ensina a construção em outro repositório, com requisitos, fases e gerador independente. A nova capacidade `run_command` é shell do host por `--allow-host-shell`, sem as garantias do modo restrito. Este estudo conserva a descrição histórica 0.3.0 onde indicada; leia o [contrato atual de execução](../replicacao/05-CMD-E-EXECUCAO.md) para essa diferença.

Este é o ponto de entrada da documentação detalhada solicitada para compreender como um agente de programação funciona e construir nossa própria aplicação. O estudo foi feito em **21/10/2026**. A extensão implementada é **YZZY BLACK 0.3.0**; o motor oficial continua fixado em **Codex 0.163.0**.

O resultado tem três partes: estudo das superfícies públicas, implementação própria de comportamentos e mecanismos, e procedimentos reproduzíveis para engenharia de software. Cada parte tem um limite explícito. O modelo remoto permanece fornecido pela OpenAI. Não obtivemos pesos fechados, dataset de treinamento completo, prompts privados ou equivalência integral com o produto comercial.

## Roteiro de leitura

| Ordem | Documento | O que você compreenderá |
| --- | --- | --- |
| 1 | [Modelo e harness](01-MODELO-E-HARNESS.md) | Tokens, inferência, treinamento conceitual, personalização e separação entre modelo e aplicação. |
| 2 | [Protocolo e contexto](02-PROTOCOLO-E-CONTEXTO.md) | App Server, mensagens estruturadas, ciclo de ferramentas, memória, persistência e limites. |
| 3 | [Comportamento e guardrails](03-COMPORTAMENTO-E-GUARDRAILS.md) | Conversa, depuração por evidência, autoridade, políticas, falhas e estados verificáveis. |
| 4 | [Equipe de especialistas](04-EQUIPE-E-ORQUESTRACAO.md) | Catálogo executável, seleção, coordenação, orçamento global, uso no CMD e tratamento de interrupções. |
| 5 | [Java e engenharia reversa](05-JAVA-E-ENGENHARIA-REVERSA.md) | Bibliotecas, bytecode, classloaders, dependências, JVM e técnicas de diagnóstico em profundidade. |
| 6 | [Playbooks de engenharia](06-PLAYBOOKS-DE-ENGENHARIA.md) | Procedimentos para arquitetura, padrões, desenvolvimento, frontend, testes, integrações e operação. |
| 7 | [Pesquisa externa e validação](07-PESQUISA-E-VALIDACAO.md) | Consulta real de fontes, segurança de rede, contratos, testes e matriz de capacidades. |
| 8 | [Leitura do código público](08-EXTRACAO-DO-CODIGO-PUBLICO.md) | Módulos upstream fixados, diferenças para YZZY, proveniência, licença e roteiro de replicação. |
| Referência | [Fontes](FONTES.md) e [manifesto upstream](UPSTREAM.json) | Origem de afirmações, commit e hashes dos arquivos selecionados. |

Os capítulos 1–3 partem do núcleo 0.2.3 e foram revisados para a extensão 0.3.0. O baseline histórico e as validações anteriores continuam preservados em [VALIDACAO.md](../VALIDACAO.md). O [guia científico da raiz](../../GUIA_CIENTIFICO_DE_REPLICACAO.md) explica como outro projeto pode adotar os contratos sem herdar conclusões não demonstradas.

## Começar pelo CMD

Com o comando global já ligado a este checkout:

```bat
yzzy --version
yzzy agent list
yzzy agent show java
yzzy --agent java
yzzy team plan "Investigue um erro de biblioteca interna Java e proponha uma correção"
yzzy team run "Investigue o erro Java documentado neste projeto" --specialists java,debugger,tester
```

Execute na pasta do projeto ou acrescente `--workspace "C:/projetos/aplicacao"`. O plano não usa inferência. `team run` usa o modelo configurado e consome a cota da modalidade correspondente. A equipe opera em leitura por padrão. Autorizações independentes:

```bat
yzzy team run "Corrija o problema descrito em docs/bug.md" --specialists architect,java,tester --allow-write --allow-exec --allow-network
```

As flags concedem capacidades dentro das demais políticas. Não instalam Java, não ampliam `writeRoots`, não habilitam shell livre, não removem restrições do perfil e não criam um ambiente de build que esteja ausente. `--allow-network` permite somente a ferramenta de documentação; os comandos Docker permanecem sem rede. Escolha poucas consultas quando houver pouco orçamento.

No chat existem `/agents`, `/agent java` e `/team <objetivo>`. A equipe abre sessões novas; o texto de conversas anteriores não é incluído implicitamente. Coloque no objetivo os requisitos relevantes. Ao final, use o comando de inspeção informado pelo CLI.

## Como avaliar as afirmações

**Público documentado** significa que uma fonte primária descreve o recurso. **Inspecionado no código** significa que apontamos um módulo e uma versão. **Implementado** significa que há um caminho executável no YZZY. **Validado offline** significa que exercitamos o controlador com provedores controlados. **Validado com modelo real** exige chamada real e registro separado. **Receita** é um procedimento para executar em ambiente apropriado; não é um teste realizado.

O nome de um especialista orienta seu trabalho. O modelo continua probabilístico e pode errar. O valor da equipe depende da seleção de contexto, da qualidade do parecer, da crítica do coordenador e dos testes realizados. Mais agentes consomem mais contexto e chamadas; não garantem melhor solução.

## Artefatos de implementação

| Módulo | Responsabilidade |
| --- | --- |
| [specialists.js](../../src/specialists.js) | Instruções originais e focos dos quinze perfis adicionais. |
| [profiles.js](../../src/profiles.js) | Catálogo final, perfis customizados e preferências. |
| [team.js](../../src/team.js) | Seleção, consultas sequenciais, síntese e relatório de equipe. |
| [agent.js](../../src/agent.js) | Ciclo de controle e enforcement de cada sessão. |
| [documentation.js](../../src/documentation.js) | HTTPS permitido, validação DNS, limite e proveniência. |
| [tools.js](../../src/tools.js) | Nove contratos de ferramentas e política anterior à execução. |
| [study-codex-source.js](../../scripts/study-codex-source.js) | Cache reproduzível de fontes públicas; não executa upstream. |

Comece a modificar o comportamento pelo perfil e pelo contrato de saída. Só adicione ferramentas quando uma necessidade concreta exigir uma capacidade nova. Defina entrada, autoridade, efeitos, limites, erros e evidência antes de conectá-la ao modelo.

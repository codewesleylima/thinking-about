# Agentes, interação e memória

Na 0.6.0, use `/estudar` para o ciclo de memória descrito abaixo. `/elevar` agora também implementa melhorias nos módulos do próprio runtime e publica a candidata aprovada. [Autoevolução e orçamento agregado](AUTOEVOLUCAO.md).

Na versão 0.5.0, `/elevar [tema]` acrescenta memória de conhecimento entre sessões. Consulte o [guia do aprendizado](APRENDIZADO-COM-ELEVAR.md): estudo HTTPS com fontes, procedimentos estruturados, recuperação lexical, validade de 30 dias, `/aprendizados` e `/esquecer`. A memória extrativa descrita abaixo continua responsável pela continuidade da conversa; os aprendizados externos não são instruções humanas e não treinam os pesos do modelo.

Desde 0.4.0, `--allow-host-shell` é uma concessão de CMD/sh do host, independente das flags de ferramentas restritas. Perfis readonly e consultas da equipe sempre a reduzem; o coordenador conserva o perfil humano. A memória registra `hostShellUsed`, e a sessão não obtém verificação independente depois desse canal. Veja [execução](replicacao/05-CMD-E-EXECUCAO.md) e [ensino de continuidade](replicacao/03-CONTEXTO-E-CONTINUIDADE.md).

## Recuperação lexical de aprendizados

Somente a consulta é limitada às primeiras 80 ocorrências relevantes, após normalização e remoção de palavras comuns, antes da deduplicação. Os campos armazenados válidos são examinados integralmente: tema, título e resumo usam OR; na ausência de correspondência principal, passos, verificação e limites devem reunir todos os termos distintos da consulta (AND). A pontuação conta termos distintos; campos adicionais não aumentam uma pontuação principal existente. Consulta sem termos relevantes não recupera lições.

Permanecem os limites de armazenamento/contexto, expiração, allowlist atual, ordenação e seleção de até três lições. Recuperar uma lição não comprova sua correção nem amplia sua autoridade. O [Cookbook consultado](https://developers.openai.com/cookbook/examples/agents_sdk/building_reliable_agents_memory_compaction.md) recomenda: “Inspect generated memory before relying on it in future runs.” Essa orientação fundamenta a revisão da memória, não o algoritmo lexical local.

A regressão independente em `tests/learning-late-tokens.test.js` cobre termos após 80 ocorrências nos campos extensos, título/resumo após tema extenso, AND entre campos tardios, corte da consulta antes da deduplicação, palavras comuns e pontuação distinta. No ensaio da 0.8.0, o controlador executou os checks em Docker e confirmou sete ganhos estáveis no perfil ampliado, passando de 45/66 para 66/66. Isso mede componentes do runtime; não constitui benchmark geral de um modelo.

## Perfis

Perfis combinam nome, descrição, instruções e restrição `readOnly` no mesmo controlador. Não são subagentes concorrentes. Desde 0.3.0 são 19 perfis, incluindo engenharia, arquitetura, padrões, Java, depuração, engenharia reversa, frontend, testes, integrações, segurança, performance, dados, operação e documentação. `reviewer`, `researcher` e `security` negam escrita/execução mesmo com `--allow-write --allow-exec`. Consulte o [catálogo e a orquestração](codex/04-EQUIPE-E-ORQUESTRACAO.md).

`yzzy team plan "objetivo"` mostra uma seleção heurística sem inferência. `yzzy team run "objetivo" --specialists java,tester` abre consultas sequenciais de leitura e uma síntese pelo coordenador. O orçamento é agregado, os pareceres têm autoria e o coordenador é o único que pode implementar quando autorizado. `/team <objetivo>` abre esse fluxo no chat. Equipes não incluem implicitamente o histórico anterior e suas sessões não são retomadas isoladamente, pois isso alteraria o orçamento compartilhado. Consulte a pergunta no relatório e inicie nova equipe com a informação necessária.

```bat
yzzy agent list
yzzy agent show coder
yzzy agent create arquiteto --instructions "Analise dependências e explique decisões com exemplos." --read-only
yzzy agent create auditor --from reviewer --instructions-file C:/instrucoes/auditor.txt
yzzy agent edit arquiteto --instructions "Explique alternativas e riscos citando arquivos."
yzzy --agent arquiteto
```

`--from` herda descrição e restrição; forneça novas instruções explicitamente. Perfis internos não podem ser sobrescritos. Nomes começam por letra minúscula, usam letras, números, `_` e `-`, até 40 caracteres. Instruções têm até 16000 bytes. `.yzzy/agents.json` armazena o catálogo com validação, lock e escrita atômica; ferramentas do modelo não podem editá-lo.

No chat, `/agents` lista e `/agent nome` seleciona em nova sessão. `YZZY.md` da raiz fornece orientação comum congelada e subordinada à política. Não há descoberta recursiva de instruções ou scripts de perfil executáveis.

## Preferências e dúvidas

```bat
yzzy settings set language pt-BR
yzzy settings set verbosity detailed
yzzy settings set tone friendly
yzzy settings set clarification essential
yzzy settings set autoSummary true
yzzy settings show
```

| Chave | Valores | Padrão |
|---|---|---|
| `language` | Texto de 1 a 40 caracteres | `pt-BR` |
| `verbosity` | `concise`, `balanced`, `detailed` | `balanced` |
| `tone` | `direct`, `friendly`, `formal` | `direct` |
| `clarification` | `essential`, `always`, `assume` | `essential` |
| `autoSummary` | Booleano `true` ou `false` | `true` |

`essential` pergunta quando faltar informação relevante que não puder ser inferida com segurança. `always` pede esclarecimento ou confirmação de entendimento antes de mudança relevante. `assume` favorece suposições explícitas para decisões reversíveis já autorizadas, mantendo dúvidas relevantes e efeitos externos sujeitos a esclarecimento. São instruções comportamentais ao modelo, não garantias nem permissões adicionais.

`ask_user` suspende em `waiting_user`. A próxima mensagem do chat ou `resume` responde sem reiniciar contadores. Preferências ficam em `.yzzy/preferences.json` por workspace. `/settings` mostra e `/set chave valor` altera em nova sessão.

## Histórico e retomada

```bat
yzzy history
yzzy inspect <id>
yzzy summary <id>
yzzy resume <id>
yzzy resume <id> "A regra correta inclui 18 anos."
yzzy export <id> --output conversa.md
```

O journal em `.yzzy/sessions/` mantém mensagens, ferramentas, resultados, decisões e checkpoints. A cadeia de hashes detecta inconsistências; não autentica contra alguém capaz de reescrever tudo. A exportação inclui mensagens humanas e respostas públicas, aplica redação e não sobrescreve arquivos. Revise antes de compartilhar.

A retomada usa snapshots congelados de perfil/preferências e exige mesmo workspace, configuração, runtime e permissões efetivas. Flags de escrita/execução devem coincidir. Atualizar runtime ou configuração exige nova sessão. O prazo padrão é absoluto de 15 minutos desde a criação, incluindo espera humana; há 24 propostas por sessão. `/new` abre outra sessão. Ajustar limites também exige nova sessão.

Não há replay de ferramenta pendente após crash. Efeito ou limpeza incerta exige inspeção e nova sessão. Um lock antigo requer conferir PID antes de remover o arquivo específico. Os guardrails de retomada continuam ativos.

## Resumo e compactação

`summary` e `/summary` geram resumo **extrativo local**, sem inferência adicional: objetivo, todas as instruções humanas literais, agente, permissões, arquivos alterados/hashes, referências de evidência, últimos erros/respostas, efeitos incertos e recursos. Não há embeddings, aprendizado de pesos ou resumo semântico por LLM.

A partir de oito mensagens e 70% do teto de bytes, `autoSummary` envia resumo e quatro blocos recentes para a próxima inferência. Blocos mantêm proposta e resultados juntos. `/compact` força essa projeção no próximo turno a partir de oito mensagens. O histórico completo permanece intacto e `context_compacted` registra a operação.

O resumo inclui `readReferences`, índice histórico das últimas 24 chamadas bem-sucedidas de `read_file`/`read_lines`, em ordem cronológica. Cada item registra chamada, ferramenta, caminho, hash e alcance (`full` ou `lines`). Trechos incluem linha inicial/final, total de linhas e `more`; leitura vazia tem `end_line: null`. O campo `omitted` conta leituras bem-sucedidas anteriores excluídas pelo limite. Leituras repetidas e revisões distintas permanecem identificáveis; falhas e escritas não entram nesse índice. Conteúdo bruto não é copiado. A regressão em `tests/memory-read-references.test.js` cobre retenção após compactação, alcance, omissões e ausência de mutação; sua execução depende da validação pelo host.

O resumo não concede autoridade. Requisitos humanos, permissões, recursos e incerteza permanecem explícitos. As referências são históricas, não comprovam a revisão atual nem dispensam releitura antes de editar. Conteúdo antigo e referências além do limite podem ser perdidos na projeção, mas permanecem no transcript integral. Se a projeção ainda exceder o limite total, a admissão bloqueia a chamada. Instruções humanas longas não são truncadas silenciosamente. Não há promessa de equivalência semântica perfeita ao histórico integral.

# 3. Contexto, comportamento, investigação e continuidade

Extensão 0.5.0: a continuidade entre sessões agora inclui [aprendizados de `/elevar`](../APRENDIZADO-COM-ELEVAR.md). Implemente a memória externa separada do resumo da conversa: proveniência observada, expiração, recuperação limitada e remoção. Ela nunca deve virar instrução humana durante compactação nem conceder capacidades ao agente.

## 3.1 O que significa ensinar um agente

Este repositório ensina um procedimento de engenharia por instruções, contratos, exemplos, código e testes. O modelo conectado interpreta esse material em seu contexto. Isso não altera pesos automaticamente, não cria conhecimento permanente em toda instalação e não concede ferramentas inexistentes.

Separe três mecanismos: treinamento altera parâmetros; contexto fornece informação para a execução atual; memória armazena informação que a aplicação seleciona em outra execução. Perfis orientam o comportamento, enquanto capacidades são objetos de política e implementações do host.

No destino, defina uma entrada de descoberta como AGENTS/README/REPLICAR e uma especificação programática. Descobrir um arquivo de instruções é uma função do cliente usado; o YZZY atual carrega YZZY da raiz, não toda árvore AGENTS. Documente o contrato real de descoberta para evitar regras silenciosamente ignoradas.

## 3.2 Hierarquia e dados não confiáveis

O sistema informa identidade, honestidade, protocolo e fronteiras. O perfil informa competência e estilo. A pessoa informa objetivo e decisões. Arquivos, páginas, resultados e pareceres fornecem dados para investigação. Uma frase em um README não pode aumentar permissões do host.

O controlador não deve depender exclusivamente da capacidade do modelo de distinguir papéis. Mesmo um modelo convencido por prompt injection precisa encontrar uma negativa executável quando pede uma ação não concedida. No shell confiável, a concessão é deliberadamente ampla; remover algumas strings do prompt não recria isolamento.

Registre instruções humanas completas e correções. Quando o objetivo mudar, conserve o histórico e evite que uma memória antiga continue sendo a única descrição do pedido. Um resumo que perde uma restrição pode causar erro mesmo se suas demais frases forem corretas.

## 3.3 Forma de conversar que produz trabalho útil

Para tarefa pequena e clara, resolva e apresente resultado. Para tarefa longa, informe brevemente o entendimento, depois descobertas e o próximo passo observável. Não substitua evidência por mensagens repetidas de progresso. Informe quando um teste está rodando, quando falta ambiente e quando houve mudança de hipótese.

Pergunte se a informação ausente muda a solução e não pode ser obtida com investigação proporcional. Exemplo: descobrir a versão no `pom.xml` é investigação; decidir uma regra de negócio não documentada pode exigir a pessoa. Uma pergunta deve conter contexto, opções quando úteis e a consequência prática.

Preferências como tom/detalhamento/frequência de dúvidas mudam a instrução de conversa, não a política de execução. O nosso formato congelado de persona impede retomar uma sessão com regras de interação diferentes sem uma nova identidade.

## 3.4 Contrato de tarefa e progresso

Um destino robusto deve poder responder: o que foi pedido, o que conta como sucesso, o que está autorizado, o que já foi observado, o que mudou e o que está pendente. A referência atual guarda parte disso em objetivo/mensagens/evidências. Um backlog estruturado mais rico é uma extensão recomendada para trabalhos longos.

Exemplo de artefato humano/planejado:

```json
{
  "objective": "Corrigir biblioteca incompatível",
  "criteria": [
    {"id":"AC1","text":"dependência resolvida é compatível","state":"pending","evidence":[]},
    {"id":"AC2","text":"regressão não reaparece","state":"pending","evidence":[]}
  ],
  "decisions": [],
  "unknowns": ["qual artefato é carregado em produção?"],
  "nextExperiment": "comparar dependency tree com a classe carregada"
}
```

Não marque um critério concluído só porque houve uma alteração relacionada. Associe evidência e revisão. Se o projeto usa issue tracker, mantenha a ligação sem enviar mensagens ou criar efeitos externos não autorizados.

## 3.5 Seleção de contexto

Comece pelo objetivo, estrutura relevante e contratos. Busque um símbolo ou mensagem literal, leia os consumidores e testes pertinentes e consulte a documentação da versão exata. Evite colocar todo o repositório em cada requisição: a janela e o custo são limitados, e muito contexto irrelevante dificulta a seleção de evidência.

O contexto deve identificar origem, versão e grau de confiança. Um trecho atual com hash é diferente de uma memória de ontem. Conteúdo de biblioteca decompilada é diferente de fonte publicada. Uma página recente pode documentar outra versão da dependência instalada.

Use leitura por trechos e perguntas delimitadas. Quando uma lista foi truncada, registre isso. A ausência de uma função em uma amostra parcial não prova que ela inexiste. Recuperação estrutural/LSP é uma evolução possível; na referência atual a busca é literal.

## 3.6 Memória implementada

O runtime extrai objetivo, mensagens humanas, permissões, arquivos alterados e hashes, evidências, erros recentes, respostas recentes, uso do shell e efeitos pendentes/incertos. Mantém o transcript completo no journal e envia uma projeção para o modelo quando o contexto cresce.

Propostas e resultados ficam em blocos consistentes. A memória não concede autoridade adicional. A projeção não reinicia contadores ou prazo. Um arquivo precisa ser relido antes de edição se a informação pode estar desatualizada. Se mesmo a projeção excede o teto, o runtime encerra por limite e preserva o histórico.

Essa é uma implementação extrativa, sem embeddings, banco vetorial ou geração semântica por outro LLM. Ela tem perda de detalhe, mas preserva explicitamente informações operacionais críticas. Não a anuncie como lembrança perfeita ou aprendizado permanente.

## 3.7 Depuração como experimento

O ciclo que o especialista deve seguir é:

```text
sintoma -> ambiente/versão -> reprodução mínima -> hipótese
       -> observação discriminante -> causa sustentada
       -> correção mínima -> caso original e regressão -> relato
```

Uma hipótese útil pode ser refutada. “A biblioteca está quebrada” é vaga. “O chamador foi compilado contra um descriptor ausente no JAR carregado” orienta comparação de bytecode e dependências. Preserve stacktrace e cadeia de causas; nem toda mensagem de exceção identifica a origem final.

Quando não conseguir reproduzir, descreva o que observou e a confiança limitada. Não invente teste para fechar a tarefa. Uma falha de compilação por cache ausente e uma falha lógica exigem próximos passos diferentes.

## 3.8 Java em profundidade

O especialista Java deve inventariar JDK de compilação/execução, wrapper, dependências e framework. Para comportamento de biblioteca, siga fonte da versão, contrato público e binário carregado. Classpath, modulepath, proxies, reflexão, inicialização estática, generics erasure, agentes e JNI podem alterar a explicação.

Com shell do host autorizado e ferramentas instaladas, é possível pedir ao sistema a execução real de `java -version`, `javap`, `jdeps`, Maven ou Gradle. A disponibilidade não vem do nome do perfil. Debugger interativo/attach, coleta de heap/JFR e alvos de produção exigem autorização e preparação específicas; não há uma UI de debugger embutida no YZZY.

O [guia Java](../codex/05-JAVA-E-ENGENHARIA-REVERSA.md) detalha procedimentos e limites. Alguns comandos que eram apenas receitas na versão 0.3.0 podem agora ser executados pelo shell autorizado; os resultados só contam como observados quando a execução realmente aconteceu no ambiente correto.

## 3.9 Equipe e crítica

Cada consulta deve ter uma pergunta específica e uma entrega verificável. O arquiteto compara limites e alternativas; o especialista de domínio investiga contratos; o testador procura casos discriminantes; segurança avalia autoridade e efeitos. O coordenador integra e implementa quando autorizado.

Especialistas não são independentes no sentido estatístico apenas por terem nomes diferentes. Podem compartilhar modelo, contexto inicial e vieses. Um avaliador deve receber critérios e evidência, preferencialmente sem uma justificativa persuasiva que o ancore. A prova funcional continua necessária.

Na referência, consultas são sequenciais, readonly e sem shell. O coordenador recebe pareceres identificados e limitados. Se uma consulta interromper por pergunta/erro/limite, o conjunto para. Não há retomada isolada porque o orçamento restante pode ter sido usado depois por outra fase.

## 3.10 Tratar estagnação

Uma sequência de chamadas não é progresso por si. Progresso pode ser localizar arquivo relevante, obter reprodução, eliminar hipótese, aplicar patch válido ou verificar um critério. Classifique repetição literal, oscilação, autorização repetida, contexto perdido e delegação circular.

Nossa implementação tem fingerprints recentes e limites globais, não um detector semântico perfeito. Comandos livres recebem as mesmas restrições de chamadas/tempo e não devem limpar o histórico de repetição apenas porque terminaram. Erro de permissão deve levar a diagnóstico, não a variações de ferramenta para o mesmo efeito negado.

## 3.11 Passagem entre sessões

Uma retomada precisa verificar raiz, configuração, runtime, perfil, concessões e operações pendentes. O ambiente pode ter mudado fora do processo. Uma ferramenta iniciada sem resultado deixa efeito potencial, por isso não pode ter replay cego.

Para trabalho de várias sessões, registre estado do projeto e próximo experimento em artefatos revisáveis. A referência não implementa um workflow distribuído com reconciliação de todos os serviços. Se o destino precisar dessa capacidade, implemente idempotência por efeito e consulta de estado no destino antes de repetir.

## 3.12 Relato final

O usuário precisa saber o que mudou, por que a opção foi escolhida, o que foi executado e o que permanece sem comprovação. Cite arquivos e fontes efetivas. Diferencie recomendação, alteração, check executado e verificação independente.

No shell do host, o sucesso é diagnóstico de uma operação em ambiente confiável. Nosso runtime mantém `completed_unverified` depois de seu uso e não transforma saída textual em avaliação independente. Isso conserva uma distinção útil mesmo quando a sessão tem autonomia ampla.

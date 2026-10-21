# Java, diagnóstico e engenharia reversa orientados por evidências

Este capítulo transforma o perfil especialista em Java em um procedimento de investigação. O objetivo é explicar uma falha a partir do programa realmente executado e produzir uma correção verificável. Não se presume que o nome de uma biblioteca, a confiança do modelo ou um código descompilado provem o comportamento de uma JVM.

**Referência documental:** fontes primárias consultadas em 21/10/2026. Os exemplos de ferramentas usam documentação do JDK 25 como referência identificável, sem afirmar que esse JDK está instalado ou seja obrigatório. Use o manual correspondente à versão real do alvo. Todos os comandos abaixo são **receitas não executadas nesta documentação**; os nomes, caminhos, versões e PID são exemplos.

## 1. Capacidade atual e preparação necessária

O YZZY lê código e relatórios de texto com `list_files`, `search`, `read_file` e `read_lines`. Pode propor alterações sujeitas à permissão de escrita, e solicitar um comando previamente cadastrado com `run_check`, sujeito à permissão de execução. Consulte [tools.js](../../src/tools.js), [executor.js](../../src/executor.js) e [configuração](../../yzzy.config.json).

No modo restrito descrito pelo baseline 0.3.0, ele **não possui shell livre, debugger interativo, leitor especializado de JAR, decompilador, cliente de repositório Maven ou anexação a JVM**. Desde 0.4.0, `--allow-host-shell` permite comandos CMD/sh e programas instalados com os privilégios do usuário; isso não instala toolchain nem cria um debugger embutido. As receitas abaixo só viram evidência após execução real. Leia [o contrato atual](../replicacao/05-CMD-E-EXECUCAO.md).

O executor atual cria um snapshot e inicia Docker com rede desabilitada, imagem já presente (`--pull=never`), usuário sem privilégios, diretório `/workspace` somente leitura, sistema de arquivos raiz somente leitura e `/tmp` limitado a 64 MiB, com `noexec`. A imagem padrão contém Node, não um ambiente Java preparado. O contêiner de verificação não alcança automaticamente o processo Java de um servidor ou do computador hospedeiro.

Para automatizar uma verificação Java, um mantenedor precisa preparar e revisar:

1. Imagem com JDK, ferramenta de build e plugins identificados, preferencialmente fixada por digest.
2. Dependências e distribuição do wrapper previamente disponíveis e legíveis sem rede. `--offline` não cria um cache inexistente.
3. Saída de compilação e caches em espaço gravável planejado; `target/` e `build/` dentro do snapshot são somente leitura. Um harness revisado pode organizar uma cópia de trabalho em `/tmp` se tamanho e política permitirem.
4. Memória, espaço temporário e tempo suficientes. O limite atual de `/tmp` pode impedir builds e dumps; alterá-lo exige mudança explícita no executor e revisão, não um argumento inventado pelo modelo.
5. Comando de `argv` fixo e cadastrado. Um `mvnw.cmd` de Windows não executa em contêiner Linux; um script POSIX sem permissão pode precisar de interpretador previamente escolhido. Não use isso para oferecer shell arbitrário ao agente.
6. Registros com versão, revisão dos arquivos, comando e resultado. Uma inspeção `javap` deve ser diagnóstico (`verification: false`), não prova suficiente de testes funcionais.

Não conceda privilégios, rede ou acesso à máquina inteira para resolver silenciosamente uma ferramenta ausente. Registre a capacidade faltante e proponha a menor integração necessária.

## 2. Primeiro estabelecer qual programa existe

Um incidente pode envolver três versões diferentes: a usada para compilar, a usada no build e a usada para executar. Antes de interpretar código, crie uma ficha:

| Informação | Evidência a procurar | Por que muda a investigação |
|---|---|---|
| JDK e fornecedor | Saída de `java -version`, `javac -version`, runtime da aplicação | Flags, formato de classe e ferramentas variam. |
| Build | Wrapper, arquivo de propriedades, toolchain, `pom.xml` ou scripts Gradle | O Java encontrado no PATH pode não ser o Java do build. |
| Artefato | Coordenadas, versão, SHA-256 do JAR, commit e origem | Mesmo nome de arquivo não garante mesmo conteúdo. |
| Empacotamento | JAR comum, fat JAR, módulos, WAR, plugins | O classpath escrito no projeto pode diferir do carregamento final. |
| Ambiente | SO, arquitetura, contêiner, argumentos, recursos | JNI, caminhos e consumo podem depender do ambiente. |
| Reprodução | Entrada mínima, resultado esperado, resultado observado | Impede corrigir um exemplo diferente do incidente. |

Receita de inventário, em ambiente explicitamente preparado:

```text
java -version
javac -version
jar --list --file lib/acme-client-2.0.jar
jcmd 1234 VM.version
```

O PID `1234` é fictício. A leitura da versão do processo exige acesso ao processo correto. Não execute `java -jar biblioteca-desconhecida.jar` como método de inventário: isso executaria código. Listar entradas de um arquivo e executar sua aplicação são operações diferentes. A ferramenta `jar` permite inspecionar as entradas e o descritor modular de um arquivo. [Manual oficial de jar](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jar.html).

## 3. Ordem de leitura de uma biblioteca interna

Use a seguinte ordem de confiança e registre onde cada observação foi obtida:

1. Contrato público e testes da versão exata: parâmetros, invariantes, erros e compatibilidade declarados.
2. Código-fonte associado ao artefato: repositório/tag/commit e `sources.jar` correspondente. Verifique se o pipeline gerou ou transformou código depois dessa origem.
3. Binário efetivamente utilizado: entradas do JAR, assinaturas, descritores e instruções das classes.
4. Observação controlada: teste de contrato, logs e perfil da mesma montagem executável.
5. Reconstrução por decompilador, quando disponível e autorizada: hipótese sobre a estrutura do programa, confrontada com bytecode e comportamento.

Fonte é mais legível, mas fonte de outra versão pode ser enganosa. Binário representa o artefato distribuído, mas não revela automaticamente o estado de execução, configurações, transformações por agentes ou implementações nativas.

Um decompilador pode reconstruir condicionais e chamadas equivalentes sem recuperar comentários, nomes locais, intenção de domínio ou a forma original de lambdas e `try/finally`. Código ofuscado, sintético ou gerado amplia essa ambiguidade. Documente “estrutura inferida de bytecode”, sem chamar isso de fonte original extraída.

Trabalhe em bibliotecas próprias, disponibilizadas para estudo ou dentro do escopo autorizado. Preserve proveniência e licença; não inclua credenciais, dumps pessoais ou código restrito em relatórios públicos.

## 4. Assinaturas e bytecode com javap

```text
javap -classpath lib/acme-client-2.0.jar -p -s -c -l -v com.acme.client.Client
```

`-p` inclui membros privados; `-s` mostra descritores; `-c` apresenta instruções; `-l` mostra tabelas de linhas e variáveis quando existentes; `-v` detalha atributos. Use descritor e dono da chamada para comparar o que o chamador espera com o que a dependência oferece. Tabelas de depuração podem faltar. O manual também alerta para seleção da entrada base ao usar a forma de classpath em JAR multirelease; selecione explicitamente a entrada da versão investigada quando necessário. [Manual oficial de javap](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html).

Exemplo didático: `invokevirtual Client.send:(Ljava/lang/String;)Ljava/lang/String;` referencia um método com um parâmetro `String` e retorno `String`. Encontrar apenas `send:(Ljava/lang/String;I)Ljava/lang/String;` em outra versão não satisfaz essa referência. Isso sustenta uma hipótese de incompatibilidade binária, não identifica sozinho qual JAR a aplicação carregou.

## 5. Dependências estáticas e grafo do build

```text
jdeps --multi-release 25 --recursive --class-path "lib/*" app.jar
jdeps --jdk-internals app.jar
```

`jdeps` ajuda a mapear dependências de classes, pacotes e módulos no binário; `--jdk-internals` procura dependências de APIs internas do JDK. Ajuste `25` à versão investigada. Não interprete um relatório limpo como cobertura de reflexão, configuração externa, JNI, classes geradas ou caminhos não presentes no artefato analisado. [Manual oficial de jdeps](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jdeps.html).

Para Maven, receitas com wrapper Windows:

```text
mvnw.cmd -o dependency:tree -Dverbose -Dincludes=com.acme:acme-client
mvnw.cmd -o help:effective-pom
```

O primeiro identifica caminhos e versões resolvidas; o segundo ajuda a localizar herança, perfis e gerenciamento efetivos. Plugins precisam estar disponíveis no cache. Não conclua “a versão mais nova sempre vence”: Maven usa mediação e gerenciamento de dependências; investigue o caminho selecionado, o escopo e o empacotamento. [Mecanismo oficial do Maven](https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html), [dependency:tree](https://maven.apache.org/plugins/maven-dependency-plugin/tree-mojo.html).

Para Gradle, substitua `:app` pelo módulo real:

```text
gradlew.bat --offline :app:dependencies --configuration runtimeClasspath
gradlew.bat --offline :app:dependencyInsight --dependency acme-client --configuration runtimeClasspath
```

Compare também `compileClasspath`. O relatório de insight informa caminhos e motivos da seleção; constraints, plataformas e regras podem alterar o resultado. A configuração válida depende dos plugins do projeto. Um grafo de build não prova o conteúdo final de uma distribuição modificada depois do build. [Relatórios oficiais do Gradle](https://docs.gradle.org/current/userguide/viewing_debugging_dependencies.html).

## 6. Carregamento, módulos e famílias de erro

Classe não é identificada apenas pelo nome textual: o loader que a define participa de sua identidade. Aplicações com plugins e servidores podem ter loaders diferentes carregando tipos de mesmo nome. Inspecione a origem e o loader da classe observada, sem depender apenas da árvore Maven. [Contrato de ClassLoader](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ClassLoader.html).

| Sintoma | Hipótese inicial | Evidência discriminante |
|---|---|---|
| `ClassNotFoundException` | Carregamento solicitado por nome não encontrou definição | Nome, loader usado, dependência e escopo de runtime. |
| `NoClassDefFoundError` | Definição necessária não disponível ou classe ficou em estado de inicialização falha | Primeira falha de inicialização e cadeia causal completa, além do arquivo presente. |
| `NoSuchMethodError` / `NoSuchFieldError` | Referência binária incompatível | Descritor no chamador, membros no binário carregado e origem das duas classes. |
| `UnsupportedClassVersionError` | Runtime não suporta o formato compilado | Versões reais e atributo de versão da classe. |
| `IllegalAccessError` / erro de acesso reflexivo | Visibilidade ou fronteira modular incompatível | Módulo chamador, exports/opens e API acessada. |
| `ClassCastException` com nomes aparentemente iguais | Possível duplicação entre loaders | Identidade de loader e origem de ambos os tipos. |
| `UnsatisfiedLinkError` | Falha no vínculo nativo | Arquitetura, biblioteca nativa e símbolo esperado. |

`ClassNotFoundException` e `NoClassDefFoundError` não são sinônimos. Leia as definições de API e investigue o primeiro erro, porque uma inicialização que falhou pode produzir novos `NoClassDefFoundError` depois. A JVM distingue carregamento, ligação e inicialização; um erro deve ser localizado nessa sequência. [ClassNotFoundException](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ClassNotFoundException.html), [NoClassDefFoundError](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/NoClassDefFoundError.html), [JVMS, capítulo 5](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-5.html).

Não trate `--add-opens` como reparo universal. Primeiro identifique quem faz a reflexão, qual contrato deveria usar e se existe versão compatível. Uma abertura temporária, quando necessária e autorizada, deve ter escopo, motivo e condição de remoção documentados.

## 7. Stacktrace como mapa, não como veredito

Leia a exceção superior, cada `Caused by`, as exceções suprimidas e o primeiro frame relevante do código controlado. Preserve ordem e horários. O último frame exibido não é automaticamente a causa raiz; wrappers e execução assíncrona podem separar o local da falha do local onde ela foi observada.

Faça uma tabela de hipóteses antes de editar:

| Hipótese | Previsão observável | Como pode ser refutada |
|---|---|---|
| Dependência errada em runtime | Método esperado ausente no JAR carregado | O mesmo descritor existe e a origem carregada é outra. |
| Inicializador estático falhou | Primeira tentativa registra exceção de inicialização | A primeira falha é resolução de classe ausente. |
| Timeout externo | Latência e falha correlacionam com dependência | Repro mínima falha sem a integração. |

Reduza o exemplo mantendo a característica que dispara o problema: versão, loader, entrada ou condição de concorrência. Se remover a condição elimina a falha, documente isso; não descarte como “não reproduziu”.

## 8. Depuração interativa e seus limites

Receita para uma aplicação de desenvolvimento autorizada, com porta de depuração em loopback:

```text
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=127.0.0.1:5005 -cp "app.jar;lib/*" com.acme.App
jdb -attach 127.0.0.1:5005
```

Dentro do JDB, um roteiro possível é `stop in com.acme.Service.process`, `cont`, `where`, `locals`, `step` e `next`. Disponibilidade de variáveis depende das informações de depuração e do estado da JVM. A conexão fornece controle do processo; não a exponha publicamente. JDB usa a arquitetura de depuração Java e pode iniciar ou conectar-se a uma JVM. [Manual oficial de jdb](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jdb.html).

Esse fluxo é uma receita para operador ou futura integração, não uma capacidade interativa oferecida hoje por `run_check`. Breakpoints podem alterar tempos e esconder condições de corrida. Uma linha da fonte incorreta pode indicar fonte de versão diferente, instrumentação ou mapeamento inexato; não prova bug do compilador. HotSwap não garante aceitar mudanças estruturais arbitrárias.

## 9. Concorrência, CPU, memória e coleta de lixo

Escolha a observação pelo sintoma: uma aplicação lenta não é necessariamente uma aplicação com CPU alta. Filas, pools exauridos, locks, I/O e pausas podem produzir o mesmo relato do usuário.

| Sintoma | Investigação proposta | O que ainda precisa ser provado |
|---|---|---|
| CPU alta | Amostras ao longo do intervalo, pilhas quentes e carga | Que o trecho quente é evitável e domina o tempo útil. |
| Espera alta | Pilhas repetidas, locks, filas, dependências | Que a espera é anormal e quem impede progresso. |
| Suspeita de deadlock | Grafo de quem possui e quem aguarda cada recurso | Ciclo real, distinguindo lentidão de bloqueio permanente. |
| Heap crescendo | Série temporal, retenção e caminhos até raízes | Crescimento de objetos vivos, não apenas alocação intensa. |
| RSS alto com heap estável | Memória nativa, buffers, threads e contêiner | Componente que explica a diferença; heap não cobre tudo. |
| Pausas | Eventos GC e distribuição de latência | Correlação no mesmo intervalo, com relógios comparáveis. |

Receitas iniciais de diagnóstico, dirigidas a um único PID conhecido:

```text
jcmd 1234 help
jcmd 1234 Thread.print -l
jcmd 1234 JFR.start name=yzzy_diag settings=default duration=60s filename=/tmp/yzzy-diag.jfr
```

Confirme comandos na JVM real. Histogramas e heap dumps podem ter impacto alto e exigir bastante disco; não são coleta rotineira automática. Restrições de usuário, contêiner e attach podem impedir o acesso. O perfil JFR `profile` produz mais dados e sobrecarga que `default`. [Manual oficial de jcmd](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html).

Análise posterior de uma gravação já autorizada:

```text
jfr summary yzzy-diag.jfr
jfr print --events jdk.ExecutionSample,jdk.JavaMonitorEnter,jdk.GarbageCollection yzzy-diag.jfr
```

O utilitário `jfr` interpreta arquivos de gravação; confira quais eventos foram habilitados. Evento ausente não prova que a operação nunca ocorreu: configuração, limiar e amostragem limitam a observação. O YZZY precisa receber um relatório textual permitido para analisá-lo com suas ferramentas atuais. [Manual oficial de jfr](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jfr.html).

Faça comparações antes/depois com mesma carga e recursos. Registre aquecimento, tamanho da amostra e percentis relevantes. Inlining, compilação JIT e desotimização podem mudar perfis e mapeamentos; uma microexecução sob debugger não prevê sozinha desempenho em produção. Não aumente heap ou troque coletor como primeira resposta sem medir o mecanismo da falha.

## 10. Instrumentação, JNI e fronteiras de observação

Um agente Java de instrumentação pode transformar bytecode. Portanto, o `.class` no disco pode não corresponder exatamente ao método executado depois das transformações. Registre argumentos de inicialização e agentes conhecidos; não atribua a uma biblioteca original uma alteração feita em runtime. Implantar instrumentação exige confiança no agente e compatibilidade com o alvo. [API oficial de instrumentação](https://docs.oracle.com/en/java/javase/25/docs/api/java.instrument/java/lang/instrument/package-summary.html).

JNI atravessa a fronteira Java/nativo. Uma assinatura Java não descreve toda a implementação em C/C++, e uma falha nativa pode exigir símbolos, arquitetura, relatório de crash e ferramentas do SO. Diferencie ausência da biblioteca, incompatibilidade de ABI e erro de memória. Não prometa reconstruir lógica nativa apenas com `javap`. [Especificação oficial de JNI](https://docs.oracle.com/en/java/javase/25/docs/specs/jni/index.html).

Relatórios de crash, heaps e gravações podem conter dados da aplicação. Analise cópias controladas, limite a coleta ao incidente e registre sanitização; a memória bruta não deve ser encaminhada automaticamente ao modelo remoto.

## 11. Exemplo completo: NoSuchMethodError após implantação

**Cenário fictício:** `CheckoutService` foi compilado com `acme-client:2.0`, que oferece `String send(String)`. A distribuição contém uma versão incompatível `1.4`. Ao executar checkout, aparece `NoSuchMethodError` para esse descritor.

1. **Fixar o observado.** Guardar stacktrace completo, entrada sintética e hashes dos artefatos. Não declarar a versão errada como fato antes de verificá-la.
2. **Formular hipótese.** O chamador exige assinatura que não existe na classe disponível ao loader em runtime.
3. **Inspecionar o chamador.** `javap` do `CheckoutService` deve mostrar a referência ao dono e descritor esperados.
4. **Inspecionar as candidatas.** Comparar assinaturas das versões `1.4` e `2.0`; listar a distribuição, inclusive JARs aninhados quando houver ferramenta apropriada.
5. **Confirmar carregamento.** Em reprodução controlada, registrar a origem e o loader da classe. A árvore de dependências isoladamente não resolve duplicação em servidor ou plugin.
6. **Localizar a seleção.** Examinar `runtimeClasspath`, escopos, mediação, BOM e processo de empacotamento. Diferenciar uma seleção no build de uma substituição na implantação.
7. **Corrigir a origem.** Alinhar a dependência e a montagem compatíveis com o contrato. Uma exclusão transitiva só é válida se as demais dependências continuarem satisfeitas; nunca apagar um JAR aleatório para “testar em produção”.
8. **Criar regressão.** Executar o checkout mínimo na montagem equivalente à distribuição e verificar o resultado esperado. Um teste unitário com classpath diferente pode passar e continuar ocultando o defeito.
9. **Comparar.** O teste deve falhar na montagem antiga pelo mecanismo investigado e passar na montagem corrigida. Registrar comandos, revisão e relatórios reais.
10. **Revisar conclusão.** Se o método existe na classe realmente carregada, refutar a hipótese e procurar identidade de loader, transformação ou assinatura diferente. A narrativa inicial não recebe prioridade sobre a evidência.

**Nenhuma dessas etapas foi executada pelo simples fato de constar neste guia.** O especialista entrega observações, hipóteses, receitas e limites; o controlador só registra verificações de fato realizadas e aceitas por sua política.

## 12. Entrega obrigatória do especialista Java

```text
Problema e comportamento esperado:
Ambiente conhecido e informações ausentes:
Artefatos, versões, hashes e origem:
Evidências observadas (arquivo/linha ou relatório):
Hipóteses ordenadas e critérios de refutação:
Menor reprodução proposta ou efetivamente executada:
Correção recomendada e contratos afetados:
Verificações realizadas, com resultados reais:
Verificações pendentes e capacidade necessária:
Riscos e alternativa reversível:
```

Esse formato permite que arquitetura, testes e segurança contestem a conclusão usando os mesmos artefatos. A disciplina central é: **um diagnóstico útil liga sintoma, mecanismo, alteração e evidência de regressão**.

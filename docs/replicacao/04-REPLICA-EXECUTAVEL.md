# 4. Gerar, executar e personalizar uma réplica independente

## 4.1 Por que existe um gerador

Um manual precisa indicar o que construir. Uma referência executável reduz outra lacuna: verificar se o conjunto mínimo realmente abre e roda fora do checkout original. `yzzy replicate` gera esse conjunto com fontes, testes, configuração e documentação. O destino pode evoluir independentemente.

O gerador não cria um modelo treinado, não copia uma conta e não apresenta a marca como totalmente renomeada. Ele personaliza nome do pacote e comando npm, preservando a identidade interna YZZY para rastreabilidade. Uma marca própria é uma tarefa adicional com critérios explícitos.

## 4.2 Pré-condições

Tenha Node.js 24+, o comando YZZY desta edição e um diretório pai existente. Escolha um caminho novo fora do repositório de origem. O gerador recusa mescla e sobrescrita. Se quiser integrar a um projeto existente, gere uma referência ao lado e adapte módulos depois de inventariar o destino.

```bat
yzzy replicate --output "C:/projetos/atlas-agent" --name atlas-agent --command atlas
```

O comando pode ser executado de qualquer pasta, porque a origem é resolvida em relação ao módulo instalado. Ele não precisa chamar modelo nem Docker. Não usa o workspace atual como uma fonte arbitrária de arquivos: os diretórios de código e os arquivos de referência são explícitos.

## 4.3 Conteúdo e exclusões

| Incluído | Motivo |
| --- | --- |
| `src/` e `bin/` | Runtime e CLI executáveis. |
| `tests/` e `scripts/` | Invariantes, diagnóstico e empacotamento. |
| `evaluations/run.js`, `tasks.json` | Laboratório e manifesto, sem resultados pessoais. |
| `docs/`, estudo original e guia | Ensino e decisões com proveniência. |
| `AGENTS.md`, `REPLICAR.md`, `YZZY.md` | Entradas de instrução e contrato do projeto. |
| Configuração e package manifest | Inicialização reproduzível da aplicação. |
| Workflow CI explícito | Referência de validação após preparar e versionar lockfile. |

Não são copiados `.git`, `.yzzy`, `.wzzy`, `node_modules`, `.env`, cache de autenticação ou pesos. Arquivos com links, tipo inesperado ou tamanho excessivo são recusados no caminho de cópia. A origem deve ser uma instalação confiável: um gerador de código não audita automaticamente se alguém colocou um segredo em um arquivo de fonte ou documento público.

`replica.manifest.json` registra produto/versão da origem, horário, alias, nome e hashes dos arquivos gerados. O hash documenta integridade de conteúdo, não autoria assinada. Ao personalizar um arquivo, é esperado que seu hash deixe de corresponder ao manifesto inicial; registre a mudança no versionamento do destino.

## 4.4 Instalação e primeira prova

```bat
cd /d "C:/projetos/atlas-agent"
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test
npm.cmd run check
npm.cmd run evaluate
node bin/yzzy.js demo --json
```

A cópia preserva as resoluções completas de `templates/replication/dependency-lock.json` e adapta nome, bin e versão da raiz. Esse asset existe porque o npm não inclui `package-lock.json` em tarballs; o gerador não depende do checkout para recuperá-lo. `npm ci` pode então usar as versões fixadas no destino. O check compara as entradas de dependências do asset e do lock local. Ao atualizar dependências, revise o novo lock e atualize o asset; diferenças de identidade do pacote raiz são esperadas e não trocam a resolução transitiva.

A demonstração usa um provedor controlado e um avaliador da fixture. Um estado `verified` nela significa somente que os critérios daquele laboratório foram aprovados. Não significa que houve inferência real ou que todos os especialistas foram avaliados.

## 4.5 Comando próprio no CMD

```bat
npm.cmd install --global . --ignore-scripts --no-audit --no-fund
npm.cmd run install:cmd
atlas --version
atlas login status
atlas login
atlas
```

O package manifest associa `atlas` ao CLI. O instalador de PATH recebe `-CommandName atlas`, valida o nome, preserva entradas existentes e verifica o shim correto. Abra um CMD novo para receber o ambiente atualizado. A instalação global do diretório liga ao checkout, por isso mover a pasta depois pode quebrar o comando.

O banner continuará identificando YZZY BLACK até você personalizar a interface. Esse comportamento é intencional e está documentado; nome de comando e identidade do motor são configurações diferentes. O login usa a instalação oficial do Codex e a conta autorizada da pessoa, não uma credencial copiada da origem.

## 4.6 Alternativas de modelo

Se escolher Codex, use autenticação oficial e o catálogo disponível à conta. Modelo vazio significa padrão resolvido pelo produto, não garantia de um ID permanente. Se escolher API direta, configure chave por ambiente, modelo e preços verificados antes de chamadas pagas. Se escolher Ollama, prepare servidor e um modelo instalado compatível com ferramentas.

Mudar o adaptador muda contexto, formato de ferramentas, uso e erros. Mantenha testes de correlação e resposta parcial. Não altere apenas uma URL esperando equivalência entre APIs. Também não trate `spent=0` do ledger Codex como execução gratuita.

## 4.7 Personalizar a marca sem perder contratos

Faça uma alteração por responsabilidade:

1. **Pacote e comando:** package name, bin e instruções de instalação. O gerador já faz essa parte.
2. **Apresentação:** banner, wordmark, prompts e mensagens em `terminal.js`/`globe.js`. Preserve acessibilidade, largura, limpeza e fallback estático.
3. **Identificadores persistidos:** escolha se muda `.yzzy`, variáveis `YZZY_*` e nomes de guidance. Se mudar, defina migração e compatibilidade; não renomeie journals existentes por busca textual global.
4. **Persona:** altere instruções dos perfis e convenções. Isso não remove schemas, política ou limite.
5. **Toolchain:** configure verificações e imagem conforme a stack. A imagem Node padrão não prepara Maven/Gradle offline.
6. **Documentação:** mantenha proveniência do derivado e registre o que diverge. A licença atual não é trocada automaticamente pelo gerador.

Depois execute testes da área, suíte obrigatória e pacote extraído. Uma atualização que modifica a identidade do runtime exige nova sessão; não masque esse controle para recuperar um journal incompatível.

## 4.8 Integrar a um projeto já existente

Não copie todo o diretório sobre uma aplicação existente. Introduza o runtime em uma área clara, escolha o comando e identifique a raiz de trabalho da aplicação. Preserve configuração, build, testes e CI existentes. Conecte sua política de identidade e armazenamento por interfaces quando necessário.

Se o destino já tem um agente, compare contrato por contrato: quem controla efeito, quem guarda estado, quem autoriza, quem calcula orçamento e quem verifica conclusão. A [spec.json](spec.json) pode virar uma tabela de correspondência com módulos locais e evidência; não precisa impor todos os nomes YZZY à aplicação.

## 4.9 Falhas do gerador e recuperação

Destino existente é erro e não modifica o conteúdo humano. Se a cópia falhar no meio por disco, acesso ou origem inválida, pode existir uma pasta parcial. Ela não deve ser tratada como réplica validada e não é removida recursivamente de forma automática. Inspecione-a e escolha outro destino novo ou faça limpeza humana deliberada.

Um destino com diretório pai ausente também falha; o gerador não cria uma hierarquia arbitrária. Um caminho dentro da própria origem é recusado para evitar recópia e crescimento recursivo. Symlinks na origem são recusados; o diretório pai de destino é canonicalizado.

## 4.10 Como comprovar independência

Os testes geram uma pasta temporária sem dependências ou sessões, inspecionam alias/dependência, executam a demo e validam a especificação. A geração é novamente tentada no mesmo destino e precisa recusar sobrescrita. O arquivo humano criado entre as tentativas deve permanecer intacto.

O teste do artefato empacotado deve repetir a geração a partir do pacote extraído. Isso evita depender de arquivos que existem no checkout, mas foram esquecidos no `files` do npm. Requisitos correspondentes: R19/R21/R22.

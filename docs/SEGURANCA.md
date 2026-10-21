# Segurança e fronteiras reais

## Autoridade

O operador escolhe workspace, arquivo de configuração, modelo, escopo e permissões. O modelo recebe ferramentas de capacidade limitada. Texto de arquivo, resposta de provedor ou saída de teste não ativa flags nem adiciona comandos. Schemas são validados localmente, mesmo quando o fornecedor oferece modo estrito.

O modo padrão permite apenas leitura de caminhos autorizados, busca e perguntas. Escrita exige `--allow-write` e um prefixo de `writeRoots`. Execução exige `--allow-exec` e nome cadastrado. Consulta externa exige `--allow-network` e domínio exato em `documentation.allowedHosts`. Não há shell arbitrário, busca aberta, provisionamento, push, publicação, mensagem externa ou instalação de pacotes controlada pelo modelo.

## Pesquisa externa e equipes

`read_documentation` admite HTTPS público sem credenciais/query/fragmento, valida hostname e todos os IPs resolvidos, fixa o endereço na conexão e revalida cada redirect. Baixa somente tipos textuais suportados, com prazo e limites. A extração de HTML não executa JavaScript e não torna o conteúdo confiável. URLs, trechos e proveniência entram no histórico e podem ser enviados ao modelo. A política não garante disponibilidade da fonte nem detecta todo segredo em uma URL. Consulte [pesquisa e fronteiras](codex/07-PESQUISA-E-VALIDACAO.md).

Na equipe, cada consulta recebe escrita e execução negadas. A síntese conserva as reduções do perfil humano, sem aumentar autoridade ao trocar para coordenador. Pareceres são dados não confiáveis. Limites de chamadas, ferramentas, tempo e gasto são agregados; Codex permanece sujeito à modalidade de cobrança do produto. Sessões de equipe não retomam isoladamente porque os recursos restantes podem ter sido transferidos à síntese. Os relatórios ficam em `.yzzy/teams`, sem assinatura própria; journals de sessões conservam o encadeamento. O lock é por sessão/gravação e não impede um editor humano de alterar arquivos entre fases.

## Filesystem

As ferramentas rejeitam caminhos absolutos, traversal, barras invertidas, ADS, caracteres de controle, nomes Windows reservados, links simbólicos, junctions, arquivos especiais e hardlinks. `.git`, `.yzzy`, `.aws`, `.ssh`, `.agents`, `.codex`, `.github`, dependências e outros diretórios de controle são excluídos. Nomes de credenciais comuns e extensões de chave são bloqueados.

Não se trata de detecção universal de segredos: `data.txt` pode conter uma chave desconhecida. O operador deve usar um workspace preparado sem dados não autorizados. Esta versão não interpreta `.gitignore` arbitrário como política de confidencialidade. Arquivos ocultos não reconhecidos podem ser lidos/copiedos. Nomes bloqueados podem produzir falsos positivos, por exemplo `secrets-guide.md`.

`YZZY.md`, `AGENTS.md`, `yzzy.config.json`, configuração explicitamente selecionada e `evaluations/` são protegidos contra escrita pelas ferramentas. O controlador possui acesso aos seus próprios arquivos de estado. `YZZY.md` só é carregado da raiz, como orientação subordinada. Não há plugins ou hooks executáveis.

A edição checa revisão e usa rename, mas a implementação Node portável não oferece proteção absoluta contra trocas de path entre syscalls por um processo host malicioso. O lock exclui instâncias cooperativas de YZZY BLACK, não editores humanos nem outros programas. Para arquivos host sob ataque ativo, execute todo o controlador em uma VM isolada. Não apresente o confinamento de ferramentas como sandbox de sistema operacional do controlador.

## Execução de código

O executor monta apenas um snapshot filtrado em `/workspace`, somente leitura. Não monta checkout original, home, socket Docker, credenciais nem journal. Usa usuário 65534, remove capabilities, aplica `no-new-privileges`, nega rede externa e limita RAM, CPU e PIDs. O root filesystem é somente leitura e `/tmp` é tmpfs limitado. Os detalhes de flags seguem a [documentação Docker](https://docs.docker.com/engine/containers/run/).

O daemon e a imagem escolhida pertencem à base de confiança. São necessários Docker local, containers Linux, imagem preparada e um operador com acesso ao daemon. Um daemon remoto pode não enxergar os diretórios temporários do cliente; essa topologia não é suportada. A imagem padrão está fixada por digest; valide novos digests e registre versão do engine ao atualizar. Container não é garantia contra vulnerabilidades do kernel/daemon e não equivale a uma VM.

Testes são código potencialmente hostil. Mesmo um comando cadastrado `node --test` executa arquivos do projeto. A cópia é filtrada antes de ser entregue ao container; não há acesso à chave do provedor por variável herdada. Rede negada não elimina canais indiretos nos resultados devolvidos ao modelo. A imagem não pode conter segredos próprios. `noexec` em `/tmp` não impede interpretadores de ler scripts nesse diretório.

O processo Docker cliente tem prazo; ao terminar ou ser cancelado, o controlador tenta remover o container pelo nome exato. Se não souber que a limpeza ocorreu, não aprova o teste e bloqueia a sessão como incerta. Um SIGKILL no controlador pode impedir seu `finally`; o nome emitido permite limpeza manual posterior. O programa não promete limpar recursos após desligamento abrupto do host.

## Dados, logs e provedor

Código lido e resultados selecionados integram o contexto enviado ao endpoint configurado. O modo Ollama é restrito a loopback, mas a política de dados do processo servidor continua sendo responsabilidade do operador. No modo OpenAI, `store:false` configura a requisição; não constitui garantia autônoma sobre retenção, requisitos legais ou política da conta do fornecedor.

Logs locais armazenam transcript, código selecionado, perguntas, hashes e evidências. Arquivos são criados com modos restritos quando o SO os aplica; ACLs Windows dependem do diretório hospedeiro. Antes de compartilhar, revise o journal. A redação cobre valores de variáveis de ambiente com nomes sensíveis e padrões conhecidos de chave, sem garantia de remover todo segredo em código, respostas ou dados arbitrários. A cadeia de hashes é íntegra após redação. Uma credencial que coincida com texto de código pode alterar esse texto no checkpoint redigido; releituras e conflitos devem ser resolvidos antes de editar após retomada.

Retenção padrão é local e sem expiração automática. Para excluir uma sessão, interrompa o processo, revise efeitos pendentes e remova somente seu arquivo `.jsonl`. Backups e retenção do provedor são separados. Não se utiliza material da sessão para treinamento automaticamente.

## Orçamento e confiabilidade

Na API OpenAI direta, reservas precedem chamadas pagas. O runtime conserva saldo retido em erros de cobrança desconhecida e não repete requisições automaticamente. O teto depende de estimativas e preços corretos; limites do provedor devem complementar o software. Mudanças de preço/tokenização podem exceder reservas sem desfazer gasto incorrido. No Codex, cobrança e cota são geridas pelo produto autenticado, sem teto financeiro em microUSD imposto pelo host. Leia a [fronteira da integração](CODEX.md): processo nativo e cache oficial de autenticação fazem parte da base de confiança.

A aplicação limita contexto e saída, mas não garante ausência de alucinação, solução correta, ausência de prompt injection semântico ou conclusão de qualquer tarefa. O status do controlador é independente do texto final. A ferramenta pode negar a exfiltração direta de um arquivo `.env` e ainda receber informação sensível embutida em outro documento permitido. A segurança observada é delimitada pelos cenários testados.

Em incidente: interrompa a sessão, preserve journal/configuração/diff, examine containers específicos e efeitos, revogue credenciais efetivamente expostas e corrija a causa com regressão antes de ampliar o escopo.

# Backlog de ajustes — Três Presentes

## Popup INSPIRA

- [x] Substituir a imagem atual do quadrante esquerdo pelo novo visual quadrado aprovado pelo usuário.
- [x] Fazer a imagem preencher integralmente o quadrante, sem barras ou espaços vazios.
- [x] Alterar o título principal do popup de “Quer continuar comigo pelo WhatsApp?” para “Quer conversar comigo no whatsapp?”.
- [x] Atualizar todos os links do grupo gratuito no popup para `https://chat.whatsapp.com/FbLqdc1jA5q84KBJkODmj0?s=cl&p=a&mlu=4&ilr=4`.
- [x] Preservar o link de conversa direta com André sem alteração.
- [x] Preservar os demais elementos e textos do popup sem alteração.
- [x] Preparar cache-busting da nova imagem.
- [x] Publicar em produção no domínio oficial `https://trespresentes.vercel.app/`.

### Implementação concluída

- Arte reconstruída no build a partir de `assets/popup-inspira/part*.b64`.
- Arquivo público mantido como `inspira-grupo-500.webp` para preservar a referência atual.
- CSS do quadrante ajustado para `aspect-ratio: 1/1` e `object-fit: cover`.
- Título do popup atualizado para: `Quer conversar comigo no whatsapp?`.
- Todos os destinos `chat.whatsapp.com` do convite ao grupo no popup usam o novo link aprovado.
- O WhatsApp direto do André permanece separado em `https://wa.me/5519981370555`.
- Publicação oficial concluída após autorização explícita do usuário.

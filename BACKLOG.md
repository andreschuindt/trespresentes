# Backlog de ajustes — Três Presentes

## Popup INSPIRA

- [x] Substituir a imagem atual do quadrante esquerdo pelo novo visual quadrado aprovado pelo usuário.
- [x] Fazer a imagem preencher integralmente o quadrante, sem barras ou espaços vazios.
- [x] Alterar o título principal do popup de “Quer continuar comigo pelo WhatsApp?” para “Quer conversar comigo no whatsapp?”.
- [x] Preservar os demais elementos e textos do popup sem alteração.
- [x] Preparar cache-busting da nova imagem.
- [ ] Publicar em produção — aguardar autorização explícita do usuário.

### Implementação preparada

- Branch de backlog: `backlog-popup-ajustes`
- Arte reconstruída no build a partir de `assets/popup-inspira/part*.b64`.
- Arquivo público mantido como `inspira-grupo-500.webp` para preservar a referência atual.
- CSS do quadrante ajustado para `aspect-ratio: 1/1` e `object-fit: cover`.
- O título do popup será atualizado no build para: `Quer conversar comigo no whatsapp?`.
- Nenhum deploy de produção deve ser feito até ordem explícita do usuário.

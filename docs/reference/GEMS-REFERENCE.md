# 🎨 Referência Visual — Gemas (imagem oficial do usuário)

> **Fonte:** `docs/reference/gems-reference.jpg` (1024×1024, enviada pelo usuário em 2026-08-03).
> **Regra:** as gemas 3D do jogo devem parecer **exatamente iguais a esta imagem, porém em 3D**.
> Esta spec é o contrato visual — qualquer mudança de cor/forma/brilho deve voltar a esta tabela.

## As 6 jóias (grid 2×3)

| Posição | Jóia | Silhueta | Facetas | Rim (outline) | Glow |
|---|---|---|---|---|---|
| top-left | **Rubi** | hexagonal alta, vértices pontiagudos topo/base | faceta hexagonal central + triângulos/trapézios radiais | crimson → hot-pink (`#FF4D6D`-família) | vermelho profundo |
| top-right | **Safira** | square cushion, cantos biselados | step-cut concêntrico + padrão estrelado central | azul gelo médio (`#59CDFF`-família) | royal-blue elétrico |
| middle-left | **Esmeralda** | retângulo horizontal, cantos bem cortados | bands step-cut + face central larga + facetas diagonais nos cantos | verde esmeralda vivo (`#3EE88A`-família) | verde brilhante |
| middle-right | **Topázio** | triangular/pêra, ápice pontiagudo NO TOPO, base larga curva | triângulos convergindo ao centro | dourado → laranja (`#FFC24D`-família) | dourado quente |
| bottom-left | **Amatista** | brilliant-cut clássica, girdle largo, ponta EMBBAIXO | radiais + kites alongados, flashes de estrela | lavanda-violeta (`#CE93F0`-família) | roxo saturado |
| bottom-right | **Âmbar** | quase circular/oval brilliant | muitas facetas radiais triangulares + face central | âmbar-laranja (`#FFB64D`-família) | laranja fogo |

## Mapeamento no jogo (`GEM_DEFS` em `src/config.js`)

```
índice  forma        cor (jogo)      cor da referência     rim (novo campo 6)
0       hexagon      Fire Ruby       vermelho              #FF5A78
1       pear         Solar Topaz     amarelo               #FFC24D
2       emerald      Emerald         verde                 #3EE88A
3       square       Aquamarine      azul                  #59CDFF
4       brilliant    Amethyst        roxo                  #CE93F0
5       sphere       **Amber** (era Frost Diamond)  laranja #FFB64D
```

> ⚠️ **Mudança 2026-08-03:** a cor 5 era "Frost Diamond" (branco-cinza), que **não existe na referência**.
> A referência mostra **âmbar/laranja** no bottom-right → trocada para **Amber** (`#FF8A1E`).

## Leitura visual obrigatória (o que o vision deve confirmar)

1. Cada gema tem **rim colorido** (não outline preto cartoony) na cor da tabela.
2. Cada gema tem **halo/glow colorido** visível ao redor (não discreto demais).
3. **Facetas nítidas** com contraste forte (crown/girdle/pavilion legíveis).
4. **Fire interno** (coração brilhante) visível no centro.
5. Silhuetas exatas: hexagonal pontiaguda / cushion / retângulo chanfrado / triângulo apex-top / brilliant ponta-embaixo / esfera facetada.

## Como validar

- Isolated preview: servir `gem-preview.html` temporário (escala 2.4) + `vision_analyze` com
  UMA pergunta curta por gema (prompts longos 400 intermitente no opencode-go).
- In-game: injetar 1 gem por coluna na row 8 (ver skill `threejs-game-development`).
- Board cheio: capturar 4 frames espaçados ~600ms (GPU stall → frames pretos falsos).

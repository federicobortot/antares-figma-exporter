# Antares Token Exporter

Plugin Figma per esportare le **Local Variable Collections** come file JSON compatibili con il formato W3C Design Tokens, pronti per essere elaborati da script di build (es. `build.js`).

---

## Funzionalità

- Legge tutte le collezioni di variabili locali presenti nel file Figma aperto
- Mostra ogni collezione con il numero di variabili e la lista dei modi (mode)
- Genera automaticamente un nome file suggerito per ogni modo (es. `primitives.json`, `mode.light.json`)
- Permette di esportare un singolo modo come file `.json`
- Permette di esportare tutti i modi in un unico archivio `.zip` con data nel nome
- Risolve i riferimenti alias tra variabili, anche tra collezioni diverse
- Non richiede dipendenze esterne

---

## Formato dell'output

Ogni file JSON esportato segue la struttura ad albero del nome della variabile, usando `/` come separatore di percorso.

Ogni foglia dell'albero segue lo standard **W3C Design Tokens Community Group (DTCG)**, con le proprietà prefissate da `$`:

```json
{
  "$type": "color" | "number" | "string" | "boolean",
  "$value": <valore>
}
```

---

## Installazione

Il plugin si carica come plugin locale in Figma (non è pubblicato nel Figma Community store).

1. Clona o scarica questa repository
2. Apri Figma Desktop
3. Vai su **Plugins → Development → Import plugin from manifest…**
4. Seleziona il file `manifest.json` dalla cartella del progetto

---

## Utilizzo

1. Apri un file Figma che contenga **Local Variable Collections**
2. Lancia il plugin da **Plugins → Development → Antares Token Exporter**
3. Il plugin mostra la lista delle collezioni con i relativi modi

### Esportazione singola

Per ogni riga (modo), modifica il nome file se necessario e clicca il pulsante **↓** a destra.  
Il file `.json` viene scaricato direttamente nel browser.

### Esportazione di massa

Clicca **↓ Scarica tutti** per esportare tutte le collezioni e tutti i modi in un unico file ZIP.  
Il file avrà nome `antares-tokens-YYYY-MM-DD.zip`.

---

## Struttura del progetto

```
antares-figma-exporter/
├── manifest.json   # Manifest del plugin Figma
├── code.js         # Logica principale (Figma API, builder JSON)
└── ui.html         # Interfaccia utente del plugin (HTML + CSS + JS inline)
```

---

## Requisiti

- Figma Desktop (la Variables API non è disponibile su Figma Web in modalità plugin di sviluppo)
- Figma versione con supporto alle **Local Variable Collections** (introdotto nel 2023)

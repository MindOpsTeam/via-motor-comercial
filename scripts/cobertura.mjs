#!/usr/bin/env node
/**
 * Gate de cobertura da fusão.
 *
 * Numa fusão, o que se perde não é a tabela grande: é o cron que ninguém
 * lembrava, a função de disparo, a página de configuração. Some sem alarme e
 * reaparece como "sumiu tal coisa" três semanas depois.
 *
 * Este script lê o inventário dos doadores e o mapa de destinos e falha se:
 *   • algum artefato não tem linha no mapa           (pendente)
 *   • algum estado é inválido                        (só portado|fundido|equivalente)
 *   • algum destino declarado não existe no repo     (destino fantasma)
 *
 * Destino que só nasce no cutover (cron, segredo do cofre, tela que ainda vai
 * ser escrita) não vira exceção no gate: a linha declara `cutover` e o gate
 * exige que o CUTOVER.md cite aquele passo. O adiamento fica declarado e
 * rastreável em vez de virar dívida invisível.
 *
 * Uso:  node scripts/cobertura.mjs [--verboso]
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verboso = process.argv.includes('--verboso');

const ESTADOS = new Set(['portado', 'fundido', 'equivalente']);

function ler(caminho) {
  const full = resolve(raiz, caminho);
  if (!existsSync(full)) {
    console.error(`\n  Arquivo ausente: ${caminho}\n`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(full, 'utf8'));
}

const inventario = ler('merge/inventario-doadores.json');
const mapa = ler('merge/mapa-destinos.json');
const regras = mapa.regras ?? [];

const cutover = existsSync(resolve(raiz, 'CUTOVER.md'))
  ? readFileSync(resolve(raiz, 'CUTOVER.md'), 'utf8')
  : '';

/** Converte `pasta/*` num teste de prefixo; sem curinga é igualdade exata. */
function casa(padrao, chave) {
  if (padrao.endsWith('*')) return chave.startsWith(padrao.slice(0, -1));
  return padrao === chave;
}

/** A linha específica vence a genérica: a primeira que casar ganha. */
function regraDe(chave) {
  return regras.find((r) => casa(r.padrao, chave));
}

const problemas = { pendente: [], estado: [], destino: [], cutover: [] };
const adiados = [];
const contagem = { portado: 0, fundido: 0, equivalente: 0 };
const usadas = new Set();

for (const item of inventario) {
  const chave = `${item.tipo}:${item.caminho}`;
  const regra = regraDe(chave);

  if (!regra) {
    problemas.pendente.push(`${item.doador} ${chave}`);
    continue;
  }
  usadas.add(regra.padrao);

  if (!ESTADOS.has(regra.estado)) {
    problemas.estado.push(`${regra.padrao} -> estado inválido "${regra.estado}"`);
    continue;
  }
  contagem[regra.estado]++;

  // Destino adiado: exige que o roteiro de cutover tenha aquele passo escrito.
  // Compara pelo NÚMERO do passo, não pela string inteira: exigir a frase
  // literal faria o gate falhar por diferença de redação, que é ruído.
  if (regra.cutover) {
    const passo = /passo\s+(\d+)/i.exec(regra.cutover)?.[1];
    const existe = passo && new RegExp(`^##\\s*Passo\\s+${passo}\\b`, 'im').test(cutover);
    if (!existe) {
      problemas.cutover.push(`${regra.padrao} -> CUTOVER.md não tem "${regra.cutover}"`);
    } else {
      adiados.push(regra.padrao);
    }
    continue;
  }

  if (!existsSync(resolve(raiz, regra.destino))) {
    problemas.destino.push(`${regra.padrao} -> destino não existe: ${regra.destino}`);
  }
}

const orfas = regras.filter((r) => !usadas.has(r.padrao)).map((r) => r.padrao);

// ── Relatório ───────────────────────────────────────────────────────────────

const total = inventario.length;
console.log(`\nGate de cobertura — ${total} artefatos dos doadores\n`);
console.log(`  portado      ${String(contagem.portado).padStart(4)}`);
console.log(`  fundido      ${String(contagem.fundido).padStart(4)}`);
console.log(`  equivalente  ${String(contagem.equivalente).padStart(4)}`);
console.log(`  ${'-'.repeat(18)}`);
console.log(`  cobertos     ${String(contagem.portado + contagem.fundido + contagem.equivalente).padStart(4)} de ${total}`);
if (adiados.length) {
  const regrasAdiadas = new Set(adiados).size;
  console.log(`  no ar hoje   ${String(contagem.portado + contagem.fundido + contagem.equivalente - adiados.length).padStart(4)}`);
  console.log(`  no cutover   ${String(adiados.length).padStart(4)}  (${regrasAdiadas} regras, cada uma com passo declarado)`);
}
console.log();

let falhou = false;

for (const [rotulo, lista, explicacao] of [
  ['SEM DESTINO DECLARADO', problemas.pendente, 'artefato do doador que ninguém decidiu o que fazer'],
  ['ESTADO INVÁLIDO', problemas.estado, 'só valem: portado, fundido, equivalente'],
  ['DESTINO FANTASMA', problemas.destino, 'o mapa aponta para um caminho que não existe no repo'],
  ['CUTOVER NÃO CITADO', problemas.cutover, 'destino adiado precisa do passo declarado no CUTOVER.md'],
]) {
  if (lista.length === 0) continue;
  falhou = true;
  // Uma regra com curinga cobre dezenas de arquivos; repetir a mesma linha
  // dezenas de vezes esconde os outros problemas. Agrupa e mostra a contagem.
  const agrupado = new Map();
  for (const linha of lista) agrupado.set(linha, (agrupado.get(linha) ?? 0) + 1);
  console.log(`  ${rotulo} (${lista.length} em ${agrupado.size} regra${agrupado.size > 1 ? 's' : ''}) — ${explicacao}`);
  const entradas = [...agrupado.entries()].sort((a, b) => b[1] - a[1]);
  for (const [linha, n] of entradas.slice(0, verboso ? entradas.length : 15)) {
    console.log(`    ${linha}${n > 1 ? `  (${n} artefatos)` : ''}`);
  }
  if (!verboso && entradas.length > 15) console.log(`    ... e mais ${entradas.length - 15} regras (use --verboso)`);
  console.log();
}

if (orfas.length) {
  console.log(`  AVISO — ${orfas.length} regra(s) do mapa não casaram com nada no inventário:`);
  for (const p of orfas) console.log(`    ${p}`);
  console.log('  (regra que não cobre nada costuma ser padrão escrito errado)\n');
}

if (falhou) {
  console.log('  GATE VERMELHO — a fusão não pode ser declarada pronta.\n');
  process.exit(1);
}

console.log('  GATE VERDE — todo artefato do doador tem destino declarado e existente.\n');

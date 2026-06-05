const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = '/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon';
const formulasXlsx = path.join(ROOT, 'excell', 'formulas pladain.xlsx');
const stocksXlsx = path.join(ROOT, 'excell', 'STOCKS MP 26.xlsx');
const insumosJsonPath = path.join(ROOT, 'src', 'infrastructure', 'api', 'mock', 'data', 'insumos.json');
const formulasJsonPath = path.join(ROOT, 'src', 'infrastructure', 'api', 'mock', 'data', 'formulas.json');
const stockMpJsonPath = path.join(ROOT, 'src', 'infrastructure', 'api', 'mock', 'data', 'stockMateriaPrima.json');

const formulaTargets = [
  'Lechera 13% PB alta energia',
  'Lechera 18% PB',
  'Lechera 16% sack',
  'Recria 16%',
  'Engorde 13%',
  'Recria Smart',
  'Engorde Smart',
  'Adaptación Smart',
  'CRIANZA',
];

const requiredInputs = [
  'soja harina HP',
  'pellets smart',
  'afrechillo',
  'sal',
  'nucleo',
  'maiz',
  'conchilla',
  'magnesio',
  'urea',
  'nucleo crianza',
  'cascara de soja',
  'nucleo mantenimiento',
  'BENTONITA',
  'alfa',
];

const slug = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const cleanName = (s) => String(s || '').trim().replace(/\s+/g, ' ');

const titleCase = (s) => cleanName(s).toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

const parseNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value ?? '').trim();
  if (!s) return 0;
  const normalized = s
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/%/g, '')
    .replace(/\s+/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const toMoney = (n, digits = 2) => Number((Number(n) || 0).toFixed(digits));

const categoryFromName = (name) => {
  const n = slug(name);
  if (/(maiz|trigo|grano|soja harina|cascara de soja|alfa|afrechillo)/.test(n)) return 'Grano';
  if (/(nucleo|nvm|gabamix|vitamin|mineral)/.test(n)) return 'Suplemento';
  if (/(sal|urea|bentonita|conchilla|magnesio|oxido|sulfato|cloruro)/.test(n)) return 'Aditivo';
  return 'Suplemento';
};

const nameCanonical = (name) => {
  const n = slug(name);
  const map = new Map([
    ['maiz', 'Maíz'],
    ['nucleo', 'Núcleo'],
    ['soja harina hp', 'Soja Harina HP'],
    ['bentonita', 'Bentonita'],
    ['pellets smart', 'Pellets Smart'],
    ['cascara de soja', 'Cáscara de Soja'],
    ['nucleo crianza', 'Núcleo Crianza'],
    ['nucleo mantenimiento', 'Núcleo Mantenimiento'],
  ]);
  if (map.has(n)) return map.get(n);
  return titleCase(name);
};

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

function loadWorkbookData() {
  const wb = XLSX.readFile(formulasXlsx);
  const ws = wb.Sheets['FORMULA '] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  return { wb, ws, rows };
}

function extractFormulaDefs(rows) {
  const headerRow1 = rows[0] || [];
  const defs = [];
  for (let c = 3; c < headerRow1.length; c++) {
    const maybeName = cleanName(headerRow1[c]);
    if (!maybeName) continue;
    const normalized = slug(maybeName);
    if (!formulaTargets.map(slug).includes(normalized)) continue;
    if (normalized === slug('CRIANZA')) {
      defs.push({ name: maybeName, kgCol: c + 1, pbCol: c + 2, costCol: c + 3 });
      continue;
    }
    defs.push({ name: maybeName, kgCol: c, pbCol: c + 1, costCol: c + 2 });
  }
  return defs;
}

function extractIngredients(rows) {
  const ingredients = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r] || [];
    const rawName = cleanName(row[0]);
    if (!rawName) continue;
    const rawPriceTn = parseNumber(row[1]);
    const pb = parseNumber(row[2]);
    ingredients.push({
      sourceName: rawName,
      key: slug(rawName),
      canonicalName: nameCanonical(rawName),
      priceTn: rawPriceTn,
      costKg: rawPriceTn > 0 ? rawPriceTn / 1000 : 0,
      pb,
    });
  }
  return ingredients;
}

function extractStockActualNamesAndQty() {
  const wb = XLSX.readFile(stocksXlsx);
  const ws = wb.Sheets['Stock actual'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = cleanName(row[0]);
    const qtyTn = parseNumber(row[3]);
    if (!name) continue;
    if (qtyTn <= 0) continue;
    out.push({ name, key: slug(name), qtyKg: qtyTn * 1000 });
  }
  return out;
}

function main() {
  const existingInsumos = JSON.parse(fs.readFileSync(insumosJsonPath, 'utf8'));
  const existingUmbralByName = new Map(existingInsumos.map((i) => [slug(i.nombre), i.umbral_alerta]));

  const { rows } = loadWorkbookData();
  const formulaDefs = extractFormulaDefs(rows);
  const baseIngredients = extractIngredients(rows);

  const formulaDefMap = new Map(formulaDefs.map((d) => [slug(d.name), d]));

  const inputMap = new Map();
  baseIngredients.forEach((i) => inputMap.set(i.key, i));

  const missingRequired = requiredInputs.filter((n) => !inputMap.has(slug(n)));

  const insumos = [];
  let insumoCounter = 1;
  for (const ing of baseIngredients) {
    if (!ing.canonicalName) continue;
    if (inputMap.get(ing.key) !== ing) continue;
    insumos.push({
      uid: `i-${insumoCounter++}`,
      nombre: ing.canonicalName,
      unidad_medida: 'KG',
      unidad_base: 'KG',
      umbral_alerta: typeof existingUmbralByName.get(ing.key) === 'number' ? existingUmbralByName.get(ing.key) : 0,
      ref_costo_unitario: ing.costKg > 0 ? toMoney(ing.costKg, 6) : undefined,
      proteina_bruta_pct: ing.pb > 0 ? ing.pb : undefined,
      categoria: categoryFromName(ing.canonicalName),
    });
  }

  const insumoByKey = new Map(insumos.map((i) => [slug(i.nombre), i]));
  const inExcel = new Set(baseIngredients.map((i) => i.key));

  const formulas = [];
  const omitted = [];
  let formulaCounter = 1;

  for (const target of formulaTargets) {
    const def = formulaDefMap.get(slug(target));
    if (!def) {
      omitted.push({ name: target, reason: 'No se encontró bloque de columnas en Excel.' });
      continue;
    }

    const ingredientes = [];
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r] || [];
      const rawName = cleanName(row[0]);
      if (!rawName) continue;
      const key = slug(rawName);
      if (!inExcel.has(key)) continue;

      const kgTn = parseNumber(row[def.kgCol]);
      if (kgTn <= 0) continue;
      const porcentaje = (kgTn / 1000) * 100;
      const insumo = insumoByKey.get(slug(nameCanonical(rawName))) || insumoByKey.get(key);
      if (!insumo) continue;

      const pb = typeof insumo.proteina_bruta_pct === 'number' ? insumo.proteina_bruta_pct : 0;
      const aportePct = (porcentaje / 100) * pb;
      const costoUnit = typeof insumo.ref_costo_unitario === 'number' ? insumo.ref_costo_unitario : 0;
      const costoContrib = (porcentaje / 100) * costoUnit;

      ingredientes.push({
        id_insumo: insumo.uid,
        nombre_insumo: insumo.nombre,
        porcentaje: toMoney(porcentaje, 6),
        aporte_proteina_pct: toMoney(aportePct, 6),
        aporte_proteina_g_kg: toMoney(aportePct * 10, 6),
        costo_unitario_usado: toMoney(costoUnit, 6),
        costo_contribucion_kg: toMoney(costoContrib, 6),
        fuente_costo: costoUnit > 0 ? 'REFERENCIA' : 'SIN_COSTO',
      });
    }

    const sumaPct = sum(ingredientes.map((i) => i.porcentaje));
    if (ingredientes.length === 0) {
      omitted.push({ name: def.name, reason: 'Sin ingredientes con kg/tn > 0.' });
      continue;
    }

    if (sumaPct < 99.85 || sumaPct > 100.15) {
      omitted.push({ name: def.name, reason: `Suma fuera de rango (${sumaPct.toFixed(3)}%).` });
      continue;
    }

    if (Math.abs(100 - sumaPct) > 0.01) {
      const idx = ingredientes.reduce((maxIdx, curr, i, arr) => (arr[maxIdx].porcentaje >= curr.porcentaje ? maxIdx : i), 0);
      ingredientes[idx].porcentaje = toMoney(ingredientes[idx].porcentaje + (100 - sumaPct), 6);
      const pb = typeof (insumos.find((x) => x.uid === ingredientes[idx].id_insumo)?.proteina_bruta_pct) === 'number'
        ? insumos.find((x) => x.uid === ingredientes[idx].id_insumo).proteina_bruta_pct
        : 0;
      ingredientes[idx].aporte_proteina_pct = toMoney((ingredientes[idx].porcentaje / 100) * pb, 6);
      ingredientes[idx].aporte_proteina_g_kg = toMoney(ingredientes[idx].aporte_proteina_pct * 10, 6);
      ingredientes[idx].costo_contribucion_kg = toMoney((ingredientes[idx].porcentaje / 100) * (ingredientes[idx].costo_unitario_usado || 0), 6);
    }

    const proteina = sum(ingredientes.map((i) => i.aporte_proteina_pct));
    const costoKg = sum(ingredientes.map((i) => i.costo_contribucion_kg));
    const costoTon = costoKg * 1000;
    const warningsNutri = ingredientes
      .filter((i) => typeof (insumos.find((x) => x.uid === i.id_insumo)?.proteina_bruta_pct) !== 'number')
      .map((i) => `Falta PB en ${i.nombre_insumo}`);
    const warningsCost = ingredientes
      .filter((i) => i.fuente_costo === 'SIN_COSTO')
      .map((i) => `Sin costo disponible para ${i.nombre_insumo}.`);

    formulas.push({
      uid: `for-${String(formulaCounter++).padStart(3, '0')}`,
      nombre_producto: cleanName(def.name),
      version: 1,
      esta_activa: true,
      ultima_edicion: '2026-05-29T12:00:00.000Z',
      id_usuario: 'usr-101',
      author: 'Sergio Monzón',
      createdAt: '2026-05-29T12:00:00.000Z',
      ingredientes,
      proteina_calculada_pct: toMoney(proteina, 6),
      costo_total: toMoney(costoTon, 6),
      costo_por_kg: toMoney(costoKg, 6),
      costo_por_tonelada: toMoney(costoTon, 6),
      advertencias_nutricionales: warningsNutri,
      advertencias_costos: warningsCost,
    });
  }

  const stockRows = extractStockActualNamesAndQty();
  const stock = stockRows
    .map((s, idx) => {
      const ins = insumos.find((i) => slug(i.nombre) === s.key || s.key.includes(slug(i.nombre)) || slug(i.nombre).includes(s.key));
      if (!ins) return null;
      const cost = typeof ins.ref_costo_unitario === 'number' ? ins.ref_costo_unitario : 0;
      const now = '2026-05-26T08:00:00.000Z';
      return {
        uid: `stk-${String(idx + 1).padStart(3, '0')}`,
        id_insumo: ins.uid,
        id_proveedor: 'p-1',
        lote: `${ins.uid.toUpperCase()}-2605-A`,
        cantidad_actual: toMoney(s.qtyKg, 3),
        cantidad_inicial: toMoney(s.qtyKg, 3),
        cantidad_comprometida: 0,
        costo_unitario: toMoney(cost, 6),
        costo_total: toMoney(cost * s.qtyKg, 2),
        fecha_ingreso: now,
        remito_nro: `REM-PLD-${String(idx + 1).padStart(4, '0')}`,
        ubicacion: 'Silo MP',
        id_usuario: 'usr-admin-01',
        createdAt: now,
        updatedAt: now,
        operaciones: {
          fecha: now,
          cantidad: 0,
          destino: 'STOCK INICIAL',
          id_operacion: `op-init-${idx + 1}`,
          nro_operacion: `INIT-${idx + 1}`,
          operacion: 'AJUSTE INICIAL',
        },
        stock_transito: null,
      };
    })
    .filter(Boolean);

  fs.writeFileSync(insumosJsonPath, JSON.stringify(insumos, null, 2) + '\n');
  fs.writeFileSync(formulasJsonPath, JSON.stringify(formulas, null, 2) + '\n');
  fs.writeFileSync(stockMpJsonPath, JSON.stringify(stock, null, 2) + '\n');

  console.log('Importación Excel Fórmulas Pladain — Resumen');
  console.log('Archivo fuente:', formulasXlsx);
  console.log('Hojas detectadas:', ['Hoja1', 'FORMULA '].join(', '));
  console.log('Insumos importados:', insumos.length);
  console.log('Fórmulas importadas:', formulas.length);
  formulas.forEach((f) => {
    console.log(`- ${f.nombre_producto}: proteína=${f.proteina_calculada_pct.toFixed(3)}% costo/kg=${f.costo_por_kg.toFixed(4)} costo/ton=${f.costo_por_tonelada.toFixed(2)}`);
  });
  console.log('Fórmulas omitidas:', omitted.length);
  omitted.forEach((o) => console.log(`- ${o.name}: ${o.reason}`));
  if (missingRequired.length > 0) {
    console.log('Insumos requeridos no encontrados:', missingRequired.join(', '));
  }
  console.log('Stock MP importado desde STOCKS MP 26.xlsx (filas con stock > 0):', stock.length);
}

main();

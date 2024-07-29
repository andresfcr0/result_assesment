import {
  AttributeValue,
  DescribeEndpointsCommand,
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { decode } from "jsonwebtoken";

class InvalidRequest extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "InvalidRequest";
  }
}

enum Prediction {
  table_name = "MEDICAL_PREDICTIONS",
  id = "id",
  payload = "payload",
  date = "date",
  user_id = "user_id",
  patient_id = "patient_id",
  status = "status",
  prediction = "prediction",
}

enum Patient {
  table_name = "MEDICAL_PATIENT",
  user_id = "user_id",
  tracker = "tracker",
  dob = "dob",
  gender = "gender",
  created_at = "created_at",
}

enum Outcome {
  table_name = "MEDICAL_OUTCOME",
  prediction_id = "prediction_id",
  date = "date",
  payload = "payload",
}

enum User {
  table_name = "MEDICAL_USER",
  id = "id",
  name = "name",
  email = "email",
}

enum Status {
  pending = "PENDING",
  completed = "COMPLETED",
}

enum Features {
  categoria_unica = "categoria_unica",
  tipocx = "tipocx",
  tipodeabordajecx = "tipodeabordajecx",
  edadmintervencion = "edadmintervencion",
  imc = "imc",
  sexopte = "sexopte",
  tabaquismo = "tabaquismo",
  mtabaco = "mtabaco",
  hta = "hta",
  arritmiacard = "arritmiacard",
  erc = "erc",
  fallacardcron = "fallacardcron",
  dislipidemia = "dislipidemia",
  dm = "dm",
  transtiroideo = "transtiroideo",
  diagcovid19 = "diagcovid19",
  covid19menor2 = "covid19menor2",
  esquemavacu = "esquemavacu",
  estratosocioecono = "estratosocioecono",
  afiliacionsistema = "afiliacionsistema",
  asascore = "asascore",
  complejidadprocedimiento = "complejidadprocedimiento",
  momntointerven = "momntointerven",
  inestabilidadhemodinamica = "inestabilidadhemodinamica",
  parocardiacopreoperatorio = "parocardiacopreoperatorio",
}

enum OutcomePayload {
  ubicacion = "ubicacion",
  rol = "rol",
  estanciaHospitalaria = "estanciaHospitalaria",
}

const schema = {
  all: [
    "edadmintervencion",
    "imc",
    "estratosocioecono",
    "afiliacionsistema",
    "asascore",
    "complejidadprocedimiento",
    "categoria_unica",
    "tipocx",
    "tipodeabordajecx",
    "hta",
    "tabaquismo",
    "sexopte",
    "mtabaco",
    "arritmiacard",
    "erc",
    "fallacardcron",
    "dislipidemia",
    "dm",
    "epoc",
    "transtiroideo",
    "diagcovid19",
    "covid19menor2",
    "esquemavacu",
    "momntointerven",
    "inestabilidadhemodinamica",
    "parocardiacopreoperatorio",
  ],
  numeric: ["edadmintervencion", "imc"],
  categoric: [
    "estratosocioecono",
    "afiliacionsistema",
    "asascore",
    "complejidadprocedimiento",
    "categoria_unica",
    "tipocx",
    "tipodeabordajecx",
  ],
  dicotomic: [
    "hta",
    "tabaquismo",
    "sexopte",
    "mtabaco",
    "arritmiacard",
    "erc",
    "fallacardcron",
    "dislipidemia",
    "dm",
    "epoc",
    "transtiroideo",
    "diagcovid19",
    "covid19menor2",
    "esquemavacu",
    "momntointerven",
    "inestabilidadhemodinamica",
    "parocardiacopreoperatorio",
  ],
};

const headers = {
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "Content-Type": "application/json",
};

export function JWT(code: string | undefined): { [k: string]: any } {
  if (!code) throw new InvalidRequest("Not Authorized");
  const payload = decode(code.split(" ")[1]);
  if (!payload) throw new InvalidRequest("Not Authorized");
  return payload as { [k: string]: any };
}

// DynamoDB Queries
export async function userExists(email: string) {
  const client = new DynamoDBClient();

  const params = {
    TableName: User.table_name,
    FilterExpression: "#email = :email",
    ExpressionAttributeNames: {
      "#email": User.email,
    },
    ExpressionAttributeValues: {
      ":email": { S: email },
    },
    ProjectionExpression: `${Prediction.id}`,
  };
  const data = await client.send(new ScanCommand(params));
  return data.Items?.length ? data.Items[0][User.id].S : false;
}

export async function getPredictions(
  user_id: string,
  dates: { from: number; to: number }
) {
  const client = new DynamoDBClient();

  const params = {
    TableName: Prediction.table_name,
    FilterExpression: "#user = :user AND #date > :from AND #date < :to",
    ExpressionAttributeNames: {
      "#user": Prediction.user_id,
      "#date": Prediction.date,
    },
    ExpressionAttributeValues: {
      ":user": { S: user_id },
      ":from": { N: String(dates.from) },
      ":to": { N: String(dates.to) },
    },
    ProjectionExpression: `${Prediction.id}, ${Prediction.prediction}, ${Prediction.payload}, #${Prediction.date}`,
  };
  const data = await client.send(new ScanCommand(params));
  return data.Items;
}

export function validateData(
  values: Record<string, AttributeValue>[] | undefined
) {
  if (!values || values?.length == 0)
    throw new InvalidRequest("No hay registros que analizar");
  const valid = values?.map(extractValues);
  return valid;
}

export async function getOutcomes(predictions: { [k: string]: any }) {
  const client = new DynamoDBClient();

  const ids = predictions.map((pred: any) => pred.id);
  const res: { [k: string]: any } = {};
  for (let index = 0; index < ids.length; index++) {
    res[`:val${index}`] = { S: ids[index] };
  }

  const params = {
    TableName: Outcome.table_name,
    FilterExpression: `#pred_id IN (${Object.keys(res).join(", ")})`,
    ExpressionAttributeNames: {
      "#pred_id": Outcome.prediction_id,
    },
    ExpressionAttributeValues: {
      ...res,
    },
    ProjectionExpression: `${Outcome.prediction_id}, ${Outcome.payload}`,
  };
  const data = await client.send(new ScanCommand(params));
  return data.Items;
}

export function validUUID(body: { [k: string]: any }) {
  if (
    !body ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.user_id
    )
  )
    throw new InvalidRequest("Parametro invalido");
}

export function extractValues(obj: { [k: string]: any }): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(extractValues);
  }

  if ("M" in obj) {
    return extractValues(obj["M"]);
  }
  if ("S" in obj) {
    return obj["S"];
  }
  if ("N" in obj) {
    return Number(obj["N"]);
  }

  const newObj: { [k: string]: any } = {};
  for (const key of Object.keys(obj)) {
    newObj[key] = extractValues(obj[key]);
  }
  return newObj;
}

export function getValues(items: { [k: string]: any }[]): { [k: string]: any } {
  const preds: { [k: string]: any[] } = {};
  const outcomes: { [k: string]: any[] } = {};

  for (const item of items) {
    const outc = item.payload;
    const resu = item.prediction;
    for (const key of Object.keys(resu)) {
      if (Object.keys(preds).includes(key)) {
        preds[key].push(parseFloat(resu[key]));
      } else {
        preds[key] = [parseFloat(resu[key])];
      }
      if (Object.keys(outcomes).includes(key)) {
        outcomes[key].push(parseInt(outc[key]));
      } else {
        outcomes[key] = [parseInt(outc[key])];
      }
    }
  }

  return { preds, outs: outcomes };
}

export function definePred(prob: number[]): {
  one: number[];
  cero: number[];
} {
  const one: number[] = prob.filter((val) => val > 0.6);
  const cero: number[] = prob.filter((val) => val <= 0.6);
  return { one, cero };
}

export function calculateConfusionMatrix(pred: number[], out: number[]) {
  const res: boolean[] = [];
  const total_pred = pred.length;
  const predicted = pred.map((k) => (k > 0.6 ? 1 : 0));

  for (let i = 0; i < total_pred; i++) {
    res.push(predicted[i] === out[i]);
  }

  const trueCount = res.filter(Boolean).length;
  const counted = trueCount / total_pred;

  let TP = 0,
    FP = 0,
    TN = 0,
    FN = 0;

  for (let k = 0; k < total_pred; k++) {
    if (predicted[k] === out[k]) {
      if (out[k] === 1) {
        TP++;
      } else {
        TN++;
      }
    } else {
      if (out[k] === 1) {
        FN++;
      } else {
        FP++;
      }
    }
  }

  return {
    total_calculated: total_pred,
    success_predicted: trueCount,
    success_percentage: `${(counted * 100).toFixed(2)} %`,
    TP: TP,
    FP: FP,
    TN: TN,
    FN: FN,
  };
}

export function getDates(from: string | undefined, to: string | undefined) {
  return {
    from: from ? new Date(from).getTime() : 0,
    to: to ? new Date(to).getTime() : new Date().getTime(),
  };
}

function getFrecuency(data: number[], value: number) {
  return data.filter((x: number) => x == value).length;
}

function getDescriptiveStats(payload: { [k: string]: number[] }) {
  const results: { [k: string]: any } = {};
  for (const n of schema.numeric) {
    const values = payload[n];
    const promedio = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(
      values.map((x) => Math.pow(x - promedio, 2)).reduce((a, b) => a + b) /
        (values.length - 1)
    );
    const sorted = values.slice().sort((a, b) => a - b);
    const mediana =
      (sorted[Math.floor((sorted.length - 1) / 2)] +
        sorted[Math.ceil((sorted.length - 1) / 2)]) /
      2;
    const q1 = sorted[Math.floor((sorted.length - 1) / 4)];
    const q3 = sorted[Math.floor(((sorted.length - 1) * 3) / 4)];
    const rangoIntercuartilico = q3 - q1;
    results[n] = {
      promedio,
      desviacionEstandar: std,
      mediana,
      rangoIntercuartilico,
    };
  }
  return results;
}

function getFrecuencies(payload: { [k: string]: any }) {
  //Dicotomicas
  const dicotomic: { [k: string]: any } = {
    rel_frecuency: {},
    abs_frecuency: {},
    total: {},
  };
  for (const d of schema.dicotomic) {
    const count = getFrecuency(payload[d], 1);
    dicotomic.abs_frecuency[d] = count;
    dicotomic.rel_frecuency[d] = parseFloat(
      (count / payload[d].length).toFixed(4)
    );
    dicotomic.total[d] = payload[d].length;
  }

  //Categoricas
  const categoric: { [k: string]: any } = {
    rel_frecuency: {},
    abs_frecuency: {},
    total: {},
  };
  for (const c of schema.categoric) {
    const unique = [...new Set(payload[c])];
    categoric.abs_frecuency[c] = unique.map((val: any) => {
      const res: { [k: string]: any } = {};
      res[val] = getFrecuency(payload[c], val);
      return res;
    });
    categoric.rel_frecuency[c] = unique.map((val: any) => {
      return {
        [val]: parseFloat(
          (getFrecuency(payload[c], val) / payload[c].length).toFixed(4)
        ),
      };
    });
    categoric.total[c] = unique.map((val: any) => {
      return { [val]: payload[c].length };
    });
  }
  return {
    dicotomic,
    categoric,
  };
}

function getStats(age: number[]) {
  const mean = age.reduce((a, b) => a + b, 0) / age.length;
  const std = Math.sqrt(
    age.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) /
      (age.length - 1)
  );
  const sorted = age.slice().sort((a, b) => a - b);
  const median =
    (sorted[Math.floor((sorted.length - 1) / 2)] +
      sorted[Math.ceil((sorted.length - 1) / 2)]) /
    2;
  const q1 = sorted[Math.floor((sorted.length - 1) / 4)];
  const q3 = sorted[Math.floor(((sorted.length - 1) * 3) / 4)];
  const RIC = q3 - q1;
  return {
    mean,
    DE: std,
    median,
    RIC,
  };
}

function countValues(values: string[]) {
  const results: { [k: string]: any } = {};
  for (let index = 0; index < values.length; index++) {
    const value = String(values[index]);
    if (Object.keys(results).includes(value)) results[value] += 1;
    else results[value] = 1;
  }
  return results;
}

function getCountPerMonth(predictions: { [k: string]: any }[]) {
  const datesMS = predictions.map((pred) => pred.date);
  const dates = datesMS.map((d) => new Date(d));
  const yearMonths = dates.map((d) => `${d.getFullYear()}-${d.getMonth()}`);
  return countValues(yearMonths);
}

function getCount(
  predictions: { [k: string]: any },
  attribute: string,
  feature: string
) {
  const categories = predictions.map((pred: any) => pred[attribute][feature]);
  return countValues(categories);
}

export function getStatistics(
  outcomes: { [k: string]: any }[],
  predictions: { [k: string]: any }[]
) {
  const total = predictions.length;
  const perMonth = getCountPerMonth(predictions);
  const results: { [k: string]: any } = {};

  const numericFeatures = [
    Features.imc,
    Features.edadmintervencion,
    OutcomePayload.estanciaHospitalaria,
  ];
  for (const elem of Object.values(Features)) {
    if (numericFeatures.includes(elem)) {
      results[elem] = getCount(predictions, Prediction.payload, elem);
      results[elem]["stats"] = getStats(
        predictions.map((p) => p[Prediction.payload][elem])
      );
      continue;
    }
    const res = getCount(predictions, Prediction.payload, elem);
    const entries = Object.entries(res);
    entries.sort((a, b) => b[1] - a[1]);

    const top10Entries = entries.slice(0, 10);
    const result: any = {};
    top10Entries.map((top) => {
      result[top[0]] = top[1];
    });
    results[elem] = result;
  }

  for (const elem of Object.values(OutcomePayload)) {
    results[elem] = getCount(outcomes, Outcome.payload, elem);
    if (numericFeatures.includes(elem))
      results[elem]["stats"] = getStats(
        outcomes.map((p) => p[Outcome.payload][elem])
      );
  }

  return {
    total,
    perMonth,
    ...results,
  };

  // const merged = outcomes.map((item: any) => {
  //   const pred = predictions.find(
  //     (p: any) => p[Prediction.id] === item[Outcome.prediction_id]
  //   );
  //   return {
  //     ...item,
  //     prediction: pred ? pred[Prediction.prediction] : null,
  //   };
  // });

  // const predicted: { [k: string]: any } = {};
  // const stats: { [k: string]: any } = {};

  // const { preds, outs } = getValues(merged);
  // for (let k of Object.keys(preds)) {
  //   const { one, cero } = definePred(preds[k]);
  //   stats[k] = calculateConfusionMatrix(preds[k], outs[k]);
  //   predicted[k] = { one, cero };
  // }

  // const payload = predictions.map((pred: any) => pred.payload);

  // const all: { [k: string]: any } = {};
  // for (const k of schema.all) {
  //   all[k] = payload.map((val: any) => val[k]);
  // }

  // const frecuencies = getFrecuencies(all);
  // const descriptive = getDescriptiveStats(all);

  // return {
  //   results: preds,
  //   outcome: outs,
  //   predicted,
  //   stats,
  //   ...frecuencies,
  //   ...descriptive,
  // };
}

export function success_response(body: { [k: string]: any }) {
  return { statusCode: 200, body: JSON.stringify(body), headers: headers };
}

export function error_response(error: string) {
  return {
    statusCode: 409,
    body: JSON.stringify({
      message: "Ocurrio un error durante el procesamiento de la informacion",
      error: error,
    }),
    headers: headers,
  };
}

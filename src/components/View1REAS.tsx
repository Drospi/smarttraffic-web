import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckSquare,
  Compass,
  Eye,
  Gauge,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface ReasItem {
  code: 'R' | 'E' | 'A' | 'S';
  title: string;
  subtitle: string;
  accentClass: string;
  badgeColor: string;
  icon: ReactNode;
  bullets: readonly string[];
}

const REAS_ITEMS: readonly ReasItem[] = [
  {
    code: 'R',
    title: 'Rendimiento (R)',
    subtitle: 'Cómo medimos si lo hace bien',
    accentClass: 'pixel-panel-green',
    badgeColor: '#39ff14',
    icon: <Gauge className="w-5 h-5 text-[#39ff14]" />,
    bullets: [
      'Reducir el tiempo promedio de espera por vehículo (en segundos).',
      'Acortar la cantidad de vehículos esperando en cada fila.',
      'Maximizar el total de vehículos que logran cruzar por ciclo.',
      'Evitar que las cuadras centrales entre ambos cruces se llenen más del 78%.',
      'Cumplir el 100% de las reglas de seguridad vial (0 fallos) y decidir en menos de 20 ms.',
    ],
  },
  {
    code: 'E',
    title: 'Entorno (E)',
    subtitle: 'Corredor vial urbano de La Paz',
    accentClass: 'pixel-panel-cyan',
    badgeColor: '#00f0ff',
    icon: <Compass className="w-5 h-5 text-[#00f0ff]" />,
    bullets: [
      'Corredor real de Sopocachi (La Paz): Plaza Avaroa / Av. 20 de Octubre (I1) y Av. 6 de Agosto (I2).',
      'Conectados horizontalmente por C. Pedro Salazar y C. Belisario Salinas.',
      '2 tramos centrales entre Av. 20 de Octubre y Av. 6 de Agosto (capacidad máx. 24 vehículos c/u).',
      'Llegada variable y aleatoria de vehículos en cada ciclo (tráfico real de hora pico en Sopocachi).',
      'Ciclo fijo de 70 segundos (60 s de verde repartibles + 2 s amarillo + 3 s todo rojo por fase).',
    ],
  },
  {
    code: 'A',
    title: 'Actuadores (A)',
    subtitle: 'Acciones físicas sobre los semáforos',
    accentClass: 'pixel-panel-amber',
    badgeColor: '#ffb800',
    icon: <Sliders className="w-5 h-5 text-[#ffb800]" />,
    bullets: [
      'Semáforos coordinados en Av. 20 de Octubre / C. Pedro Salazar (Plaza Avaroa) y Av. 6 de Agosto / C. Pedro Salazar.',
      'Aplican los segundos exactos de luz verde elegidos al iniciar cada nuevo ciclo.',
      'Respetan siempre 2 segundos de luz amarilla y 3 segundos de todo rojo para despejar cada esquina.',
      'Garantizan que dos vías perpendiculares nunca tengan luz verde al mismo tiempo.',
    ],
  },
  {
    code: 'S',
    title: 'Sensores (S)',
    subtitle: 'Variables reales que lee cada ciclo',
    accentClass: 'pixel-panel-pink',
    badgeColor: '#ff0055',
    icon: <Radio className="w-5 h-5 text-[#ff0055]" />,
    bullets: [
      'Cantidad de vehículos esperando en cada una de las 4 filas.',
      'Cantidad de vehículos ocupando las 2 cuadras centrales entre ambos cruces.',
      'Cuántos vehículos llegaron en el último ciclo por cada acceso.',
      'Qué calle tiene luz verde, cuánto tiempo pasó del ciclo y los segundos del plan actual.',
    ],
  },
];

interface EnvProperty {
  id: string;
  dimension: string;
  classification: string;
  opposite: string;
  accent: string;
  justification: string;
  impact: string;
}

const ENV_PROPERTIES: readonly EnvProperty[] = [
  {
    id: 'obs',
    dimension: 'Observabilidad',
    classification: 'Parcialmente observable',
    opposite: 'Totalmente observable',
    accent: '#ffb800',
    justification:
      'Los sensores miden cuántos vehículos esperan en fila y cuántos ocupan las cuadras centrales, pero pueden fallar ocasionalmente y nadie conoce con certeza exacta cuántos vehículos llegarán en el próximo minuto.',
    impact:
      'Por eso el agente usa un plan de respaldo seguro si falta una lectura y proyecta varios escenarios posibles de tráfico.',
  },
  {
    id: 'det',
    dimension: 'Predictibilidad',
    classification: 'Estocástico (aleatorio)',
    opposite: 'Determinista (predecible)',
    accent: '#ff0055',
    justification:
      'La cantidad de vehículos que llegan por ciclo varía todo el tiempo de forma aleatoria, con picos inesperados en hora punta o ráfagas repentinas.',
    impact:
      'Motiva probar cada plan contra 8 escenarios diferentes de tráfico (desde el más cargado hasta el más ligero) para protegerse del peor caso.',
  },
  {
    id: 'epi',
    dimension: 'Efecto en el tiempo',
    classification: 'Secuencial',
    opposite: 'Episódico (independiente)',
    accent: '#00f0ff',
    justification:
      'Los vehículos que no alcanzan a cruzar en este ciclo se quedan en fila para el siguiente, y los que cruzan llenan la cuadra hacia el otro semáforo.',
    impact:
      'El agente simula el efecto de cada decisión durante los próximos 4 ciclos completos para evitar provocar trancaderas más adelante.',
  },
  {
    id: 'dyn',
    dimension: 'Evolución',
    classification: 'Dinámico',
    opposite: 'Estático',
    accent: '#39ff14',
    justification:
      'El tráfico sigue llegando y moviéndose en la avenida mientras el agente decide el próximo plan semafórico.',
    impact:
      'Gracias a la poda Alfa-Beta descarta los malos planes en menos de 20 milisegundos, siempre a tiempo antes del cambio de ciclo.',
  },
  {
    id: 'dis',
    dimension: 'Momento de decisión',
    classification: 'Discreto',
    opposite: 'Continuo',
    accent: '#00f0ff',
    justification:
      'El agente no corta luces a mitad de ciclo: decide exactamente cada 70 segundos ajustando tiempos en bloques seguros de 3 o 6 segundos.',
    impact:
      'Permite revisar una lista finita y ordenada de planes seguros sin confundir a los conductores.',
  },
  {
    id: 'agt',
    dimension: 'Coordinación',
    classification: 'Agente Individual Centralizado',
    opposite: 'Semáforos aislados sin coordinación',
    accent: '#39ff14',
    justification:
      'Un solo agente coordina al mismo tiempo los semáforos de Av. 20 de Octubre (Plaza Avaroa) y Av. 6 de Agosto unidos por C. Pedro Salazar y C. Belisario Salinas.',
    impact:
      'Evita que el primer semáforo mande demasiados vehículos si la cuadra hacia el segundo semáforo ya está llena.',
  },
];

type PracticalCaseId = 'hora_pico' | 'rafaga_transversal';

interface StepCaseExample {
  inputLabel: string;
  inputValues: readonly string[];
  processFormula: string;
  processNote: string;
  outputLabel: string;
  outputSummary: string;
  conventionalContrast: string;
}

interface UtilityStep {
  id: number;
  label: string;
  shortTitle: string;
  question: string;
  detail: string;
  color: string;
  examples: Record<PracticalCaseId, StepCaseExample>;
}

const PRACTICAL_CASES: Record<
  PracticalCaseId,
  { title: string; badge: string; context: string; accent: string }
> = {
  hora_pico: {
    title: 'Caso A: Hora Pico C. Pedro Salazar (08:15 AM)',
    badge: 'CONGESTIÓN PEDRO SALAZAR',
    context:
      'Muchos vehículos cruzando desde Plaza Avaroa por C. Pedro Salazar hacia Av. 6 de Agosto y retornando hacia C. Belisario Salinas, mientras Av. 20 de Octubre y Av. 6 de Agosto tienen filas moderadas.',
    accent: '#00f0ff',
  },
  rafaga_transversal: {
    title: 'Caso B: Ráfaga Av. 20 de Octubre y 6 de Agosto (18:40 PM)',
    badge: 'RÁFAGA EN AVENIDAS',
    context:
      'De golpe se llenan Av. 20 de Octubre (subiendo junto a Plaza Avaroa) y Av. 6 de Agosto (bajando desde Belisario Salinas), mientras C. Pedro Salazar se despeja temporalmente.',
    accent: '#ffb800',
  },
};

const UTILITY_FLOW: readonly UtilityStep[] = [
  {
    id: 0,
    label: '1. SENSORES',
    shortTitle: 'Medición del tráfico',
    question: '¿Qué ve en la calle?',
    detail:
      'Al terminar cada ciclo de 70 segundos, los sensores cuentan cuántos vehículos esperan en cada fila, cuántos autos ocupan las cuadras centrales y cuál es el reparto actual de segundos de luz verde.',
    color: '#ff0055',
    examples: {
      hora_pico: {
        inputLabel: 'Lectura real del corredor Sopocachi (Ciclo 12)',
        inputValues: [
          'Vehículos en fila (I1 Plaza Avaroa): C. Pedro Salazar = 18 vehículos | Av. 20 de Octubre = 4 vehículos',
          'Vehículos en fila (I2 Av. 6 de Agosto): Retorno Pedro Salazar / Belisario = 16 vehículos | Av. 6 de Agosto = 5 vehículos',
          'Cuadra central entre 20 de Octubre y 6 de Agosto: Ida = 17 de 24 vehículos (71%) | Vuelta = 15 de 24 vehículos (63%)',
          'Plan de semáforos actual: 30 s C. Pedro Salazar / 30 s Avenidas (20 de Octubre y 6 de Agosto)',
        ],
        processFormula:
          'Datos recolectados = Vehículos en cada fila + Vehículos en cuadras centrales + Plan actual',
        processNote:
          'Si un sensor llega a fallar, el sistema detecta la ausencia de dato y mantiene un plan seguro de respaldo.',
        outputLabel: 'Fotografía actual del tráfico lista',
        outputSummary:
          'El agente recibe las cantidades exactas de vehículos esperando y la ocupación de las dos cuadras centrales.',
        conventionalContrast:
          'Un semáforo convencional NO tiene sensores: nunca se entera de que hay 18 vehículos en la avenida principal y solo 4 en la transversal.',
      },
      rafaga_transversal: {
        inputLabel: 'Lectura real del corredor Sopocachi (Ciclo 10 — Ráfaga)',
        inputValues: [
          'Vehículos en fila (I1 Plaza Avaroa): C. Pedro Salazar = 6 vehículos | Av. 20 de Octubre = 19 vehículos',
          'Vehículos en fila (I2 Av. 6 de Agosto): Retorno Pedro Salazar = 7 vehículos | Av. 6 de Agosto = 17 vehículos',
          'Cuadras centrales: Ida = 9 de 24 vehículos (38%) | Vuelta = 8 de 24 vehículos (33%)',
          'Plan de semáforos actual: 36 s C. Pedro Salazar / 24 s Av. 20 de Octubre y 6 de Agosto',
        ],
        processFormula:
          'Datos recolectados = Vehículos en cada fila + Vehículos en cuadras centrales + Plan actual',
        processNote:
          'Los detectores captan de inmediato que la congestión saltó hacia las calles transversales.',
        outputLabel: 'Alerta de cambio brusco de tráfico',
        outputSummary:
          'Queda registrado que las calles transversales tienen el triple de vehículos esperando que la avenida principal.',
        conventionalContrast:
          'Un semáforo fijo seguiría desperdiciando segundos de verde en la avenida casi vacía mientras las calles laterales se trancan.',
      },
    },
  },
  {
    id: 1,
    label: '2. ESTADO ACTUAL',
    shortTitle: 'Diagnóstico del corredor',
    question: '¿Cómo está el tráfico ahora?',
    detail:
      'El agente junta los datos de ambos cruces para entender la situación completa: suma los vehículos ya detenidos más los que vienen avanzando por la cuadra central, y revisa si alguna cuadra está cerca de llenarse (78%).',
    color: '#00f0ff',
    examples: {
      hora_pico: {
        inputLabel: 'Diagnóstico combinado de ambos cruces en Sopocachi',
        inputValues: [
          'Carga total en C. Pedro Salazar (cruce Av. 20 de Octubre): 18 en fila + unos 10 llegando desde la cuadra central',
          'Carga total en C. Pedro Salazar / Belisario (cruce Av. 6 de Agosto): 16 en fila + unos 12 llegando desde la cuadra central',
          'Cuadra central entre 20 de Octubre y 6 de Agosto al 71%: quedan solo 7 espacios libres antes de provocar trancadera',
        ],
        processFormula:
          'Carga real de cada calle = Vehículos ya en fila + Vehículos que cruzan desde la cuadra central',
        processNote:
          'Como ambos cruces están conectados, el agente sabe que debe dar más verde a los dos semáforos coordinadamente para que los autos entren y también salgan.',
        outputLabel: 'Diagnóstico: saturación en la avenida principal',
        outputSummary:
          'Con 30 segundos no alcanzan a pasar todos los vehículos de la avenida; se necesita transferir segundos desde las transversales.',
        conventionalContrast:
          'El semáforo convencional nunca analiza si la cuadra del medio está casi llena, por lo que provoca bloqueos entre esquinas.',
      },
      rafaga_transversal: {
        inputLabel: 'Diagnóstico combinado de ambos cruces en Sopocachi',
        inputValues: [
          'Avenidas verticales sobrecargadas: 19 vehículos subiendo por Av. 20 de Octubre y 17 bajando por Av. 6 de Agosto',
          'C. Pedro Salazar ligera: solo 6 y 7 vehículos esperando en fila',
          'Cuadra central entre ambas avenidas holgada (38% y 33%): mucho espacio libre disponible',
        ],
        processFormula:
          'Diagnóstico = Sobrecarga en calles transversales + espacio libre en las cuadras centrales',
        processNote:
          'Al estar despejadas las cuadras centrales, es totalmente seguro quitar segundos a la avenida principal y dárselos a las calles laterales.',
        outputLabel: 'Diagnóstico: prioridad inmediata a calles transversales',
        outputSummary:
          'El agente prioriza probar planes que aumenten el tiempo de verde en las calles transversales.',
        conventionalContrast:
          'Un semáforo fijo de 30/30 no percibe que el embotellamiento cambió de calle.',
      },
    },
  },
  {
    id: 2,
    label: '3. SIMULACIÓN A FUTURO',
    shortTitle: 'Proyección de 4 ciclos',
    question: '¿Qué pasará si aplico un plan?',
    detail:
      'Antes de cambiar los semáforos reales, el agente prueba mentalmente cada plan candidato durante los próximos 4 ciclos (280 segundos) imaginando 8 escenarios posibles de llegadas de vehículos.',
    color: '#ffb800',
    examples: {
      hora_pico: {
        inputLabel: 'Comparando dos opciones en un escenario de tráfico pesado',
        inputValues: [
          'Opción actual (30s principal / 30s transversal): pasan máximo 17 vehículos por ciclo en la avenida',
          'Opción candidata (39s principal / 21s transversal): pasan hasta 22 vehículos por ciclo en la avenida',
          'Llegada esperada en este escenario: cerca de 48 vehículos por ciclo en total en el corredor',
        ],
        processFormula:
          'Fila del próximo ciclo = Fila actual + Vehículos que llegan + Vehículos de la cuadra central − Vehículos que logran pasar en verde',
        processNote:
          'Con 30 segundos, la fila de la avenida principal crece sin parar hasta 27 vehículos. Con 39 segundos, la fila empieza a bajar mientras las transversales siguen pasando cómodas con sus 21 segundos.',
        outputLabel: 'Proyección de espera y filas para cada plan',
        outputSummary:
          'El modelo calcula exactamente cuántos segundos esperarían los vehículos y qué tan larga sería la fila más grande con cada plan.',
        conventionalContrast:
          'Un semáforo convencional nunca simula el futuro: simplemente repite el mismo reloj aunque la fila crezca por cuadras.',
      },
      rafaga_transversal: {
        inputLabel: 'Comparando dos opciones ante la ráfaga lateral',
        inputValues: [
          'Opción actual (36s principal / 24s transversal): solo pasan 14 vehículos por ciclo en las transversales',
          'Opción candidata (24s principal / 36s transversal): pasan hasta 21 vehículos por ciclo en las transversales',
          'Llegada esperada en las transversales: 18 a 19 vehículos por ciclo',
        ],
        processFormula:
          'Fila del próximo ciclo = Fila actual + Vehículos que llegan en el ciclo − Vehículos que logran pasar en verde',
        processNote:
          'Con 24 segundos la calle lateral colapsa (llega a 29 vehículos en fila). Con 36 segundos logra vaciar la ráfaga ciclo tras ciclo sin afectar la avenida principal.',
        outputLabel: 'Predicción exacta del alivio en calles laterales',
        outputSummary:
          'Comprueba de antemano que trasladar 12 segundos hacia las transversales frena el embotellamiento.',
        conventionalContrast:
          'Sin proyectar los próximos ciclos, un ajuste improvisado podría atascar la avenida principal.',
      },
    },
  },
  {
    id: 3,
    label: '4. EVALUACIÓN DE UTILIDAD',
    shortTitle: 'Puntaje de congestión',
    question: '¿Qué tan bueno o malo es cada plan?',
    detail:
      'El agente convierte el resultado de cada escenario en un único Puntaje de Congestión combinando tres variables claras: Tiempo total de espera (pesa 50%), Fila más larga alcanzada (pesa 30%) y Ciclos con cuadra saturada (pesa 20%). Menor puntaje significa mejor flujo.',
    color: '#39ff14',
    examples: {
      hora_pico: {
        inputLabel: 'Puntaje real calculado en el escenario más pesado (4 ciclos)',
        inputValues: [
          'Plan Actual (30s/30s): 11,200 s de espera (36.8 pts) + Fila máx. 27 veh (27.0 pts) + 2 ciclos saturados (10.0 pts)',
          'Plan Candidato (39s/21s): 6,400 s de espera (21.1 pts) + Fila máx. 16 veh (16.0 pts) + 0 ciclos saturados (0.0 pts)',
        ],
        processFormula:
          'Puntaje de congestión = Tiempo de espera (50%) + Fila más larga (30%) + Ciclos saturados (20%)',
        processNote:
          'El plan actual suma 73.8 puntos de congestión, mientras que el plan de 39s/21s suma solo 37.1 puntos (casi la mitad de congestión).',
        outputLabel: 'Comparación numérica justa entre planes',
        outputSummary:
          'El agente ve claramente que el plan de 39s/21s reduce casi a la mitad el peor nivel de congestión.',
        conventionalContrast:
          'Un semáforo normal no mide ni espera ni longitud de filas; el agente basado en utilidad optimiza directamente la experiencia del conductor.',
      },
      rafaga_transversal: {
        inputLabel: 'Puntaje real calculado en el escenario más pesado (4 ciclos)',
        inputValues: [
          'Plan Actual (36s/24s): 10,800 s de espera (35.5 pts) + Fila máx. 29 veh (29.0 pts) + 2 ciclos saturados (10.0 pts)',
          'Plan Candidato (24s/36s): 5,900 s de espera (19.4 pts) + Fila máx. 15 veh (15.0 pts) + 0 ciclos saturados (0.0 pts)',
        ],
        processFormula:
          'Puntaje de congestión = Tiempo de espera (50%) + Fila más larga (30%) + Ciclos saturados (20%)',
        processNote:
          'El puntaje cae de 74.5 puntos a 34.4 puntos y los ciclos con cuadra saturada bajan de 2 a 0.',
        outputLabel: 'Ranking claro de utilidad por plan',
        outputSummary:
          'Confirma que dar 36 segundos a las calles transversales es la opción con mayor beneficio real.',
        conventionalContrast:
          'Equilibra espera, filas largas y espacio en las cuadras en un solo indicador fácil de comparar.',
      },
    },
  },
  {
    id: 4,
    label: '5. PODA ALFA-BETA + SEGURIDAD',
    shortTitle: 'Descarte rápido y seguro',
    question: '¿Cómo elige rápido sin perder seguridad?',
    detail:
      'Primero elimina cualquier plan inseguro (menos de 20 s en avenida principal, menos de 16 s en transversal o suma distinta de 60 s). Luego compara los planes seguros usando Poda Alfa-Beta: apenas un plan muestra un puntaje igual o peor que el mejor plan guardado, se descarta sin perder tiempo revisando sus demás escenarios.',
    color: '#00f0ff',
    examples: {
      hora_pico: {
        inputLabel: 'Cómo funciona el descarte rápido en la práctica',
        inputValues: [
          '1) Reglas de seguridad: rechaza planes extremos como 48s/12s porque dejan muy poco tiempo a la calle lateral.',
          '2) Mejor referencia guardada (Beta): el plan de 39s/21s logra 37.1 puntos en su peor caso.',
          '3) Poda inmediata: al probar 24s/36s, en el primer escenario ya marca 89.2 puntos (Alfa) → como es peor que 37.1, se descartan sus otros 7 escenarios sin calcularlos.',
        ],
        processFormula:
          'Si el peor puntaje de un plan (Alfa) ≥ mejor plan guardado (Beta) → Descartar escenarios restantes',
        processNote:
          'Esto ahorra más del 60% del trabajo de cálculo y permite decidir en menos de 1 milisegundo garantizando exactamente el mismo ganador.',
        outputLabel: 'Plan ganador certificado: 39 s principal / 21 s transversal',
        outputSummary:
          'Óptimo ante el peor escenario de tráfico y 100% dentro de las normas de seguridad vial.',
        conventionalContrast:
          'Sin la poda tendría que calcular todo; sin el filtro de seguridad podrían proponerse tiempos peligrosos para peatones y autos.',
      },
      rafaga_transversal: {
        inputLabel: 'Cómo funciona el descarte rápido en la práctica',
        inputValues: [
          '1) Reglas de seguridad: bloquea cualquier plan que baje la avenida principal por debajo de 20 segundos.',
          '2) Mejor referencia guardada (Beta): el plan de 24s/36s establece 34.4 puntos como marca a vencer.',
          '3) Poda inmediata: los planes con mucho verde en la avenida (como 42s/18s) superan 34.4 en el primer escenario y se podan al instante.',
        ],
        processFormula:
          'Si el peor puntaje de un plan (Alfa) ≥ mejor plan guardado (Beta) → Se ahorran ~61% de cálculos',
        processNote:
          'No pierde tiempo probando escenarios fáciles de un plan que ya falló en el escenario difícil.',
        outputLabel: 'Plan ganador certificado: 24 s principal / 36 s transversal',
        outputSummary:
          'Listo en menos de 1 milisegundo y sin ninguna infracción de seguridad.',
        conventionalContrast:
          'Se adapta casi instantáneamente al cambio de demanda manteniendo tiempos mínimos seguros.',
      },
    },
  },
  {
    id: 5,
    label: '6. ACTUADORES',
    shortTitle: 'Aplicación en la calle',
    question: '¿Qué ven los conductores en La Paz?',
    detail:
      'Al empezar el siguiente ciclo de 70 segundos, los semáforos de Av. 20 de Octubre (Plaza Avaroa) y Av. 6 de Agosto aplican los nuevos segundos de verde, respetando siempre 2 segundos de amarillo y 3 segundos de todo rojo para dejar el cruce vacío.',
    color: '#39ff14',
    examples: {
      hora_pico: {
        inputLabel: 'Secuencia exacta aplicada en ambos semáforos de Sopocachi (Ciclo = 70 s)',
        inputValues: [
          'Cruce I1 (20 de Octubre y P. Salazar): 39 s Verde P. Salazar → 2 s Amarillo → 3 s Todo Rojo → 21 s Verde Av. 20 de Octubre → 2 s Amarillo → 3 s Todo Rojo',
          'Cruce I2 (6 de Agosto y P. Salazar):   39 s Verde P. Salazar → 2 s Amarillo → 3 s Todo Rojo → 21 s Verde Av. 6 de Agosto → 2 s Amarillo → 3 s Todo Rojo',
          'Suma total exacta: 39 + 2 + 3 + 21 + 2 + 3 = 70 segundos seguros',
        ],
        processFormula:
          'Nuevos segundos aplicados → Vacía las filas reales → En 70 segundos los sensores vuelven al Paso 1',
        processNote:
          'Pasan más de 5 vehículos extra por ciclo por C. Pedro Salazar hacia Av. 6 de Agosto, evitando que la trancadera rodee Plaza Avaroa.',
        outputLabel: 'Ciclo continuo en operación real',
        outputSummary:
          'Al terminar los 70 segundos, el agente vuelve a leer los sensores y repite el proceso adaptándose a la nueva situación.',
        conventionalContrast:
          'En 30 ciclos de Hora Pico atiende 29% más vehículos y reduce a menos de la mitad la fila máxima frente al semáforo fijo.',
      },
      rafaga_transversal: {
        inputLabel: 'Secuencia exacta aplicada en ambos semáforos de Sopocachi (Ciclo = 70 s)',
        inputValues: [
          'Cruce I1 (20 de Octubre y P. Salazar): 24 s Verde P. Salazar → 2 s Amarillo → 3 s Todo Rojo → 36 s Verde Av. 20 de Octubre → 2 s Amarillo → 3 s Todo Rojo',
          'Cruce I2 (6 de Agosto y P. Salazar):   24 s Verde P. Salazar → 2 s Amarillo → 3 s Todo Rojo → 36 s Verde Av. 6 de Agosto → 2 s Amarillo → 3 s Todo Rojo',
          'Cuando termina la ráfaga en Av. 20 de Octubre y Av. 6 de Agosto, el agente reequilibra automáticamente hacia C. Pedro Salazar.',
        ],
        processFormula:
          'Nuevos segundos aplicados → Despeja la ráfaga transversal → En 70 segundos vuelve al Paso 1',
        processNote:
          'Los tiempos de amarillo y todo rojo jamás se reducen, garantizando cruces sin colisiones.',
        outputLabel: 'Adaptación automática y reversible',
        outputSummary:
          'Controla la ráfaga imprevista y vuelve a la normalidad apenas disminuye el tráfico lateral.',
        conventionalContrast:
          'En el escenario de Ráfaga Temporal reduce la espera promedio en 47% y la fila máxima en 80%.',
      },
    },
  },
];

interface View1REASProps {
  onNextView: () => void;
}

export function View1REAS({ onNextView }: View1REASProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(ENV_PROPERTIES[0].id);
  const [activeFlowStep, setActiveFlowStep] = useState<number>(0);
  const [activeCase, setActiveCase] = useState<PracticalCaseId>('hora_pico');

  const selectedProperty =
    ENV_PROPERTIES.find((p) => p.id === selectedPropertyId) ?? ENV_PROPERTIES[0];
  const currentStep = UTILITY_FLOW[activeFlowStep];
  const currentExample = currentStep.examples[activeCase];
  const currentCaseMeta = PRACTICAL_CASES[activeCase];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Encabezado de Diapositiva */}
      <div className="pixel-panel-cyan p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-block px-2 py-1 text-[10px] font-pixel bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff] mb-2">
            DIAPOSITIVA 01 / 05 — FUNDAMENTACIÓN DEL AGENTE
          </span>
          <h2 className="font-pixel text-sm sm:text-base text-white leading-relaxed">
            REAS, PROPIEDADES DEL ENTORNO Y AGENTE BASADO EN UTILIDAD
          </h2>
          <p className="text-xs sm:text-sm text-[#a6b4db] mt-1">
            Cómo percibe, evalúa y coordina el tráfico nuestro agente inteligente en Sopocachi (Plaza Avaroa, Av. 20 de Octubre, Av. 6 de Agosto, C. Pedro Salazar y C. Belisario Salinas).
          </p>
        </div>
        <button type="button" onClick={onNextView} className="arcade-btn arcade-btn-cyan">
          SIGUIENTE: ALGORITMO
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* BLOQUE 1: TABLA / TARJETAS REAS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#39ff14]" />
          <h3 className="font-pixel text-xs sm:text-sm text-[#39ff14]">
            1. MODELO REAS DE SMARTTRAFFIC LA PAZ
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {REAS_ITEMS.map((item) => (
            <article key={item.code} className={`${item.accentClass} p-4 flex flex-col gap-3`}>
              <div className="flex items-center justify-between border-b-2 border-[#232c52] pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-9 h-9 flex items-center justify-center font-pixel text-sm text-[#090a14] font-bold shrink-0"
                    style={{ backgroundColor: item.badgeColor }}
                  >
                    {item.code}
                  </span>
                  <div>
                    <h4 className="font-pixel text-[11px] text-white leading-snug">{item.title}</h4>
                    <p className="text-[11px] text-[#9aa8d1]">{item.subtitle}</p>
                  </div>
                </div>
                {item.icon}
              </div>
              <ul className="space-y-2 text-xs text-[#d7e0f7] leading-relaxed">
                {item.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 w-1.5 h-1.5 shrink-0"
                      style={{ backgroundColor: item.badgeColor }}
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      {/* BLOQUE 2: MATRIZ INTERACTIVA DE PROPIEDADES DEL ENTORNO */}
      <div className="pixel-panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#242d54] pb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#00f0ff]" />
            <h3 className="font-pixel text-xs sm:text-sm text-[#00f0ff]">
              2. PROPIEDADES DEL ENTORNO DE TRABAJO (FICHA INTERACTIVA)
            </h3>
          </div>
          <span className="text-[11px] text-[#9aa8d1]">
            Haz clic en cada propiedad para ver cómo influye en las decisiones del semáforo inteligente
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ENV_PROPERTIES.map((prop) => {
              const active = prop.id === selectedProperty.id;
              return (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(prop.id)}
                  className={`text-left p-3 border-2 transition-all cursor-pointer ${active
                      ? 'bg-[#171d3d] shadow-[4px_4px_0_#04050a]'
                      : 'bg-[#0c0f20] border-[#263059] hover:border-[#4c5ea3]'
                    }`}
                  style={active ? { borderColor: prop.accent } : undefined}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-[#95a4cf] font-bold">
                      {prop.dimension}
                    </span>
                    <CheckSquare className="w-4 h-4 shrink-0" style={{ color: prop.accent }} />
                  </div>
                  <div className="font-pixel text-[11px] leading-snug" style={{ color: prop.accent }}>
                    {prop.classification}
                  </div>
                  <div className="text-[11px] text-[#707da6] mt-1 line-through">
                    {prop.opposite}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="lg:col-span-5 bg-[#0b0e1d] border-2 p-4 flex flex-col justify-between gap-4"
            style={{ borderColor: selectedProperty.accent }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase font-bold text-[#95a4cf]">
                  Dimensión: {selectedProperty.dimension}
                </span>
                <span
                  className="px-2 py-0.5 text-[10px] font-pixel text-[#090a14]"
                  style={{ backgroundColor: selectedProperty.accent }}
                >
                  ACTIVA
                </span>
              </div>
              <h4
                className="font-pixel text-xs sm:text-sm leading-relaxed"
                style={{ color: selectedProperty.accent }}
              >
                {selectedProperty.classification}
              </h4>
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase text-[#00f0ff]">
                  Por qué ocurre en La Paz:
                </div>
                <p className="text-xs sm:text-sm text-[#dde6fc] leading-relaxed">
                  {selectedProperty.justification}
                </p>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-[#222b52]">
                <div className="text-[11px] font-bold uppercase text-[#39ff14]">
                  Cómo lo resuelve nuestro agente:
                </div>
                <p className="text-xs sm:text-sm text-[#c7d3f5] leading-relaxed">
                  {selectedProperty.impact}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-[#8f9ec9] bg-[#111428] border border-[#28325e] px-3 py-2">
              Resumen del entorno: <strong>parcialmente observable</strong>,{' '}
              <strong>aleatorio (estocástico)</strong>, <strong>secuencial</strong>, <strong>dinámico</strong>,{' '}
              <strong>discreto cada 70 s</strong> y coordinado por un <strong>agente individual centralizado</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 3: DIAGRAMA DEL AGENTE BASADO EN UTILIDAD AMPLIADO CON EJEMPLOS PRÁCTICOS */}
      <div className="pixel-panel-green p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#233a2a] pb-3">
          <div>
            <h3 className="font-pixel text-xs sm:text-sm text-[#39ff14]">
              3. ARQUITECTURA DEL AGENTE BASADO EN UTILIDAD
            </h3>
            <p className="text-xs text-[#a5b3db] mt-1">
              Elige un caso práctico real de La Paz y recorre los 6 pasos para ver en lenguaje sencillo qué datos entran, qué evalúa y qué decide el agente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFlowStep((prev) => (prev + UTILITY_FLOW.length - 1) % UTILITY_FLOW.length)}
              className="arcade-btn arcade-btn-green !py-1.5 !px-2.5 !text-[10px]"
            >
              ◀ ANT
            </button>
            <span className="font-pixel text-[10px] text-[#39ff14] px-1">
              {activeFlowStep + 1}/{UTILITY_FLOW.length}
            </span>
            <button
              type="button"
              onClick={() => setActiveFlowStep((prev) => (prev + 1) % UTILITY_FLOW.length)}
              className="arcade-btn arcade-btn-green !py-1.5 !px-2.5 !text-[10px]"
            >
              SIG ▶
            </button>
          </div>
        </div>

        {/* Selector de Caso Práctico en Vivo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(['hora_pico', 'rafaga_transversal'] as const).map((caseId) => {
            const meta = PRACTICAL_CASES[caseId];
            const isSelected = activeCase === caseId;
            return (
              <button
                key={caseId}
                type="button"
                onClick={() => setActiveCase(caseId)}
                className={`p-3 border-2 text-left transition-all cursor-pointer ${isSelected
                    ? 'bg-[#161e3d] shadow-[4px_4px_0_#04050a]'
                    : 'bg-[#090a14] border-[#242e57] hover:border-[#4b5ca1]'
                  }`}
                style={isSelected ? { borderColor: meta.accent } : undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="font-pixel text-[10px]" style={{ color: meta.accent }}>
                    {meta.title}
                  </span>
                  <span
                    className="px-2 py-0.5 text-[9px] font-pixel"
                    style={{
                      backgroundColor: isSelected ? meta.accent : '#394678',
                      color: isSelected ? '#090a14' : '#cbd5f5',
                    }}
                  >
                    {meta.badge}
                  </span>
                </div>
                <p className="text-[11px] text-[#b9c6eb] leading-snug">{meta.context}</p>
              </button>
            );
          })}
        </div>

        {/* Flujo visual en 6 bloques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-stretch">
          {UTILITY_FLOW.map((step, idx) => {
            const isActive = idx === activeFlowStep;
            const isCompleted = idx < activeFlowStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveFlowStep(idx)}
                className={`p-3 border-2 text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${isActive
                    ? 'bg-[#182140] -translate-y-0.5'
                    : isCompleted
                      ? 'bg-[#0f162c] border-[#2f4b3c]'
                      : 'bg-[#0b0e1d] border-[#263059] hover:border-[#4b5ca1]'
                  }`}
                style={
                  isActive
                    ? {
                      borderColor: step.color,
                      boxShadow: `4px 4px 0 #04050a, 0 0 12px ${step.color}55`,
                    }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-pixel text-[9px]" style={{ color: step.color }}>
                    {step.label}
                  </span>
                  {idx < UTILITY_FLOW.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-[#5b6a9c] hidden lg:block shrink-0" />
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white leading-snug">{step.question}</p>
                  <p className="text-[10px] text-[#8d9cc7] mt-1">{step.shortTitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Panel ampliado con Explicación + Ejemplo Práctico paso a paso */}
        <div
          className="bg-[#090a14] border-2 p-4 sm:p-5 space-y-4"
          style={{ borderColor: currentStep.color }}
        >
          {/* Cabecera del paso */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-[#1f284d] pb-3">
            <div className="space-y-1.5 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="font-pixel text-[10px] px-2.5 py-1 text-[#090a14]"
                  style={{ backgroundColor: currentStep.color }}
                >
                  {currentStep.label}
                </span>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {currentStep.question}
                </span>
                <span
                  className="text-[10px] font-mono-code px-2 py-0.5 border"
                  style={{ borderColor: currentCaseMeta.accent, color: currentCaseMeta.accent }}
                >
                  {currentCaseMeta.title}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#d4def8] leading-relaxed">
                {currentStep.detail}
              </p>
            </div>
            <div className="text-[11px] font-mono-code text-[#8e9dc9] shrink-0 bg-[#111428] border border-[#232c52] px-3 py-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#39ff14] shrink-0" />
              <div>
                Ciclo cerrado cada <strong>70 segundos</strong>
                <br />
                Coordinación continua entre ambos cruces
              </div>
            </div>
          </div>

          {/* Desglose práctico: Entrada -> Cómo se evalúa -> Resultado */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
            {/* Columna 1: Datos de entrada */}
            <div className="bg-[#111428] border-2 border-[#2a3566] p-3.5 space-y-2">
              <div className="font-pixel text-[9px] text-[#00f0ff] uppercase">
                ▶ DATOS EN LA PRÁCTICA
              </div>
              <div className="font-bold text-white text-xs">{currentExample.inputLabel}</div>
              <ul className="space-y-1.5 text-[11px] text-[#cfd9f7]">
                {currentExample.inputValues.map((val, idx) => (
                  <li key={idx} className="bg-[#090a14] border-l-2 border-[#00f0ff] px-2 py-1.5 leading-relaxed">
                    {val}
                  </li>
                ))}
              </ul>
            </div>

            {/* Columna 2: Relación en palabras claras */}
            <div className="bg-[#111428] border-2 border-[#ffb800]/70 p-3.5 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="font-pixel text-[9px] text-[#ffb800] uppercase">
                  ⚙ CÓMO LO CALCULA (EN PALABRAS)
                </div>
                <div className="bg-[#090a14] border border-[#ffb800] px-2.5 py-2 text-[11px] text-[#ffd466] font-bold leading-relaxed">
                  {currentExample.processFormula}
                </div>
                <p className="text-xs text-[#dce4fb] leading-relaxed">
                  {currentExample.processNote}
                </p>
              </div>
              <div className="text-[10px] text-[#9aa8d1] border-t border-[#263059] pt-2">
                Paso {activeFlowStep + 1} de 6 en el ciclo de decisión del agente.
              </div>
            </div>

            {/* Columna 3: Resultado y Contraste con Semáforo Convencional */}
            <div className="bg-[#111428] border-2 border-[#39ff14]/70 p-3.5 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="font-pixel text-[9px] text-[#39ff14] uppercase">
                  ✓ RESULTADO DEL PASO
                </div>
                <div className="font-bold text-white text-xs">{currentExample.outputLabel}</div>
                <p className="text-xs text-[#d6f5d6] leading-relaxed">
                  {currentExample.outputSummary}
                </p>
              </div>

              <div className="bg-[#240b18] border border-[#ff0055] p-2.5 space-y-1">
                <div className="font-pixel text-[8px] text-[#ff0055] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  VS. SEMÁFORO CONVENCIONAL FIJO
                </div>
                <p className="text-[11px] text-[#ffc4d8] leading-snug">
                  {currentExample.conventionalContrast}
                </p>
              </div>
            </div>
          </div>

          {/* Barra visual del lazo cerrado completo */}
          <div className="bg-[#111428] border border-[#24305c] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#a8b6de]">
            <span>
              <strong className="text-[#39ff14]">Ciclo continuo cada 70 s:</strong>{' '}
              Sensores → Estado Actual → Simulación de 4 ciclos → Puntaje de Congestión → Poda Alfa-Beta + Seguridad → Semáforos ↺
            </span>
            <button
              type="button"
              onClick={() => setActiveFlowStep((prev) => (prev + 1) % UTILITY_FLOW.length)}
              className="text-[#00f0ff] hover:underline font-bold cursor-pointer"
            >
              Ver paso siguiente ({((activeFlowStep + 1) % UTILITY_FLOW.length) + 1}/6) →
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

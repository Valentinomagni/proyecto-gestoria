import { describe, expect, it } from "vitest";
import { aCentavos, formatear, parsear, sumar, aDecimal } from "./plata";

/**
 * Los numeros de estos tests NO son inventados: salen de las imagenes del pedido.
 *
 *  - $ 2.505.627,92 es el saldo que mostraba el sitio de Habitualista [img 02].
 *  - $ 1.294.511,00 y $ 1.044.912,25 son pagos reales del listado [img 03].
 *  - 1.100.000, 800.000 y 670.000 son depositos del cuaderno de la gestora [img 01].
 *
 * Se eligieron asi a proposito: un test con numeros redondos inventados no habria encontrado
 * el problema de los centavos, que es justo el que este modulo existe para evitar.
 */

describe("aCentavos", () => {
  it("convierte un numero de PostgREST a centavos enteros", () => {
    expect(aCentavos(1294511.0)).toBe(129451100);
    expect(aCentavos(1044912.25)).toBe(104491225);
    expect(aCentavos(2505627.92)).toBe(250562792);
  });

  it("acepta tambien texto, porque no esta verificado como serializa PostgREST un numeric", () => {
    expect(aCentavos("1294511.00")).toBe(129451100);
    expect(aCentavos("1044912.25")).toBe(104491225);
  });

  it("un valor ausente es cero, no NaN", () => {
    // Un NaN contamina toda la suma sin dejar rastro: el total sale NaN y nadie sabe de donde.
    expect(aCentavos(null)).toBe(0);
    expect(aCentavos(undefined)).toBe(0);
    expect(aCentavos("")).toBe(0);
  });

  it("redondea al centavo, no trunca", () => {
    expect(aCentavos(0.005)).toBe(1);
    expect(aCentavos(0.004)).toBe(0);
  });

  it("rechaza lo que no es un numero, en vez de devolver basura", () => {
    expect(() => aCentavos("mil pesos")).toThrow();
    expect(() => aCentavos(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("sumar", () => {
  it("suma los cinco pagos iguales del 13/08 sin desviarse un centavo", () => {
    // [img 03]: cinco pagos de $ 1.044.912,25 a SYS RENTACAR el mismo dia.
    const uno = aCentavos(1044912.25);
    expect(sumar(uno, uno, uno, uno, uno)).toBe(522456125);
  });

  it("no deriva sumando muchos importes con centavos", () => {
    // El caso que rompe con decimales: mil veces 0,10 tiene que dar exactamente 100,00.
    const diez = aCentavos(0.1);
    expect(sumar(...Array.from({ length: 1000 }, () => diez))).toBe(10000);
  });

  it("suma negativos, que es como se descuenta del saldo", () => {
    expect(sumar(250562792, -129451100)).toBe(121111692);
  });
});

describe("formatear", () => {
  it("formatea el saldo real del sitio de Habitualista", () => {
    expect(formatear(250562792)).toBe("$ 2.505.627,92");
  });

  it("formatea importes de los pagos reales", () => {
    expect(formatear(129451100)).toBe("$ 1.294.511,00");
    expect(formatear(104491225)).toBe("$ 1.044.912,25");
  });

  it("muestra el negativo con el signo adelante, no entre parentesis", () => {
    // Un saldo negativo se muestra, no se oculta ni se recorta a cero: el pedido dice que
    // intentan tener siempre dinero disponible, y taparlo seria sacar la senal que importa.
    expect(formatear(-129451100)).toBe("-$ 1.294.511,00");
  });

  it("el cero es cero, no vacio", () => {
    expect(formatear(0)).toBe("$ 0,00");
  });
});

describe("parsear", () => {
  it("acepta las dos formas que conviven en el cuaderno", () => {
    // [img 01]: los depositos aparecen escritos de las dos maneras.
    expect(parsear("1.100.000")).toBe(110000000);
    expect(parsear("1100000")).toBe(110000000);
  });

  it("acepta la coma decimal argentina", () => {
    expect(parsear("1.044.912,25")).toBe(104491225);
    expect(parsear("670000,50")).toBe(67000050);
  });

  it("ignora el signo de pesos y los espacios", () => {
    expect(parsear("$ 1.100.000")).toBe(110000000);
    expect(parsear("  670.000  ")).toBe(67000000);
  });

  it("devuelve null cuando no se entiende, en vez de adivinar", () => {
    expect(parsear("")).toBeNull();
    expect(parsear("mil")).toBeNull();
    expect(parsear("1.2.3,4,5")).toBeNull();
  });

  it("el redondeo del cuaderno queda a la vista: 666.000 no es 670.000", () => {
    // [img 01], GARAY AGUSTINA NAHIR: 450.000 + 200.000 + 16.000 = 666.000, y el deposito
    // pedido es 670.000. Esos 4.000 de diferencia existen en todas las filas del cuaderno, y
    // si el sistema no los muestra alguien va a creer que el sistema esta mal.
    const lineas = sumar(parsear("450.000")!, parsear("200.000")!, parsear("16.000")!);
    const deposito = parsear("670.000")!;
    expect(lineas).toBe(66600000);
    expect(deposito - lineas).toBe(400000);
    expect(formatear(deposito - lineas)).toBe("$ 4.000,00");
  });
});

describe("aDecimal", () => {
  it("vuelve a decimal para escribir en un numeric de Postgres", () => {
    expect(aDecimal(250562792)).toBe("2505627.92");
    expect(aDecimal(-129451100)).toBe("-1294511.00");
    expect(aDecimal(0)).toBe("0.00");
  });

  it("ida y vuelta sin perdida", () => {
    for (const n of [0, 1, 400000, 66600000, 250562792, -129451100]) {
      expect(aCentavos(aDecimal(n))).toBe(n);
    }
  });
});

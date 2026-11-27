# Landing del sitio principal (`/`)

Objetivo único: que una academia empiece su prueba gratis en un plan. Cada pantalla tiene **una** acción principal
(«Empieza tu prueba de 14 días» / «Probar 14 días gratis»); «Ingresar» es secundaria.

## Persuasión honesta (sí)

- **Precio visible y real**: los planes salen de la base (`public_plans()`: solo los activos y de pago), con sus límites.
- **Reversión de riesgo verdadera**: 14 días gratis (`subscription_for_new_owner`), sin tarjeta, sin cargos automáticos,
  sin permanencia. Se repite cerca de cada botón.
- **Etiqueta del plan destacado con un hecho**: «Con el que empieza tu prueba» (la prueba usa el plan de pago más barato).
- **Prueba social solo con hechos**: hecho en Chile, pesos y RUT, transferencia, datos aislados, pensado para el celular.
- **Botón fijo en el celular** al pasar el inicio, con el precio «desde» real.
- **Preguntas frecuentes** que responden las objeciones (tarjeta, fin de la prueba, pago, permanencia, seguridad).
- El plan elegido se recuerda (`mcrm.planElegido`) y queda preseleccionado en Ajustes → Mi suscripción.

## Patrones oscuros (no, nunca)

Prohibidos por ética y por la Ley 19.496 del consumidor (Chile) / guías del SERNAC:

- urgencia falsa (cuentas regresivas, «oferta termina hoy») o escasez falsa («quedan 3 cupos»);
- testimonios, logos de clientes, contadores o «más popular» que no estén respaldados por datos reales;
- costos escondidos o precios que cambian al pagar; casillas pre-marcadas;
- avergonzar al que se va («No, prefiero perder alumnos»), salidas escondidas o cancelación difícil;
- pedir la tarjeta para la prueba y cobrar automáticamente al terminar.

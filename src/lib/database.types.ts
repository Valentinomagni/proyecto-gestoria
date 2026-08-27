export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      avisos: {
        Row: {
          atendido_at: string | null
          atendido_por: string | null
          contexto: Json
          creado_at: string
          id: number
          quien: string | null
          resolucion: string | null
          texto: string | null
        }
        Insert: {
          atendido_at?: string | null
          atendido_por?: string | null
          contexto?: Json
          creado_at?: string
          id?: number
          quien?: string | null
          resolucion?: string | null
          texto?: string | null
        }
        Update: {
          atendido_at?: string | null
          atendido_por?: string | null
          contexto?: Json
          creado_at?: string
          id?: number
          quien?: string | null
          resolucion?: string | null
          texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avisos_atendido_por_fkey"
            columns: ["atendido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_quien_fkey"
            columns: ["quien"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cobros: {
        Row: {
          actualizado_at: string
          creado_at: string
          creado_por: string | null
          monto_cobrado: number
          observacion: string | null
          tramite_id: string
        }
        Insert: {
          actualizado_at?: string
          creado_at?: string
          creado_por?: string | null
          monto_cobrado: number
          observacion?: string | null
          tramite_id: string
        }
        Update: {
          actualizado_at?: string
          creado_at?: string
          creado_por?: string | null
          monto_cobrado?: number
          observacion?: string | null
          tramite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobros_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: true
            referencedRelation: "tramites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: true
            referencedRelation: "v_esperando_plata"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "cobros_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: true
            referencedRelation: "v_tramite_totales"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "cobros_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: true
            referencedRelation: "v_tramites"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos: {
        Row: {
          activo: boolean
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      encuestas_adopcion: {
        Row: {
          creado_at: string
          id: number
          momento: string
          respuesta: Json
          rol: string
        }
        Insert: {
          creado_at?: string
          id?: number
          momento: string
          respuesta: Json
          rol: string
        }
        Update: {
          creado_at?: string
          id?: number
          momento?: string
          respuesta?: Json
          rol?: string
        }
        Relationships: []
      }
      feriados: {
        Row: {
          fecha: string
          motivo: string
          norma: string | null
          verificado_el: string | null
          verificado_por: string | null
        }
        Insert: {
          fecha: string
          motivo: string
          norma?: string | null
          verificado_el?: string | null
          verificado_por?: string | null
        }
        Update: {
          fecha?: string
          motivo?: string
          norma?: string | null
          verificado_el?: string | null
          verificado_por?: string | null
        }
        Relationships: []
      }
      gestoras: {
        Row: {
          activa: boolean
          id: string
          nombre: string
          perfil_id: string | null
        }
        Insert: {
          activa?: boolean
          id?: string
          nombre: string
          perfil_id?: string | null
        }
        Update: {
          activa?: boolean
          id?: string
          nombre?: string
          perfil_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gestoras_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos: {
        Row: {
          anulado: boolean
          concepto: string | null
          corrige_movimiento_id: number | null
          creado_at: string
          creado_por: string | null
          fecha: string
          fecha_acreditacion: string
          gestora_id: string | null
          id: number
          importe: number
          observacion: string | null
          origen: string
          tarjeta_id: string
          tipo: string
          tramite_id: string | null
        }
        Insert: {
          anulado?: boolean
          concepto?: string | null
          corrige_movimiento_id?: number | null
          creado_at?: string
          creado_por?: string | null
          fecha?: string
          fecha_acreditacion?: string
          gestora_id?: string | null
          id?: number
          importe: number
          observacion?: string | null
          origen?: string
          tarjeta_id: string
          tipo: string
          tramite_id?: string | null
        }
        Update: {
          anulado?: boolean
          concepto?: string | null
          corrige_movimiento_id?: number | null
          creado_at?: string
          creado_por?: string | null
          fecha?: string
          fecha_acreditacion?: string
          gestora_id?: string | null
          id?: number
          importe?: number
          observacion?: string | null
          origen?: string
          tarjeta_id?: string
          tipo?: string
          tramite_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_corrige_movimiento_id_fkey"
            columns: ["corrige_movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_gestora_id_fkey"
            columns: ["gestora_id"]
            isOneToOne: false
            referencedRelation: "gestoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "tarjetas_habitualista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "v_saldos"
            referencedColumns: ["tarjeta_id"]
          },
          {
            foreignKeyName: "movimientos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "tramites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_esperando_plata"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "movimientos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramite_totales"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "movimientos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramites"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros: {
        Row: {
          clave: string
          descripcion: string
          valor: string
          verificado_el: string | null
          verificado_por: string | null
        }
        Insert: {
          clave: string
          descripcion: string
          valor: string
          verificado_el?: string | null
          verificado_por?: string | null
        }
        Update: {
          clave?: string
          descripcion?: string
          valor?: string
          verificado_el?: string | null
          verificado_por?: string | null
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          activo: boolean
          creado_at: string
          email: string
          gestora_id: string | null
          id: string
          nombre: string
          rol: string
        }
        Insert: {
          activo?: boolean
          creado_at?: string
          email: string
          gestora_id?: string | null
          id: string
          nombre: string
          rol?: string
        }
        Update: {
          activo?: boolean
          creado_at?: string
          email?: string
          gestora_id?: string | null
          id?: string
          nombre?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_gestora_fk"
            columns: ["gestora_id"]
            isOneToOne: false
            referencedRelation: "gestoras"
            referencedColumns: ["id"]
          },
        ]
      }
      plazos: {
        Row: {
          activo: boolean
          aplica_a: string
          clave: string
          consecuencia: string
          desde: string
          dias: number
          fuente: string | null
          habiles: boolean
          id: string
          nombre: string
          norma: string | null
          verificado_el: string | null
          verificado_por: string | null
        }
        Insert: {
          activo?: boolean
          aplica_a?: string
          clave: string
          consecuencia: string
          desde: string
          dias: number
          fuente?: string | null
          habiles?: boolean
          id?: string
          nombre: string
          norma?: string | null
          verificado_el?: string | null
          verificado_por?: string | null
        }
        Update: {
          activo?: boolean
          aplica_a?: string
          clave?: string
          consecuencia?: string
          desde?: string
          dias?: number
          fuente?: string | null
          habiles?: boolean
          id?: string
          nombre?: string
          norma?: string | null
          verificado_el?: string | null
          verificado_por?: string | null
        }
        Relationships: []
      }
      razones_sociales: {
        Row: {
          activa: boolean
          cuit: string | null
          id: string
          nombre: string
          orden: number
          tarjeta_id: string | null
        }
        Insert: {
          activa?: boolean
          cuit?: string | null
          id?: string
          nombre: string
          orden?: number
          tarjeta_id?: string | null
        }
        Update: {
          activa?: boolean
          cuit?: string | null
          id?: string
          nombre?: string
          orden?: number
          tarjeta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "razones_sociales_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "tarjetas_habitualista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "razones_sociales_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "v_saldos"
            referencedColumns: ["tarjeta_id"]
          },
        ]
      }
      requisitos: {
        Row: {
          activo: boolean
          aplica_a: string
          id: string
          nombre: string
          orden: number
          tipo: string
        }
        Insert: {
          activo?: boolean
          aplica_a: string
          id?: string
          nombre: string
          orden?: number
          tipo?: string
        }
        Update: {
          activo?: boolean
          aplica_a?: string
          id?: string
          nombre?: string
          orden?: number
          tipo?: string
        }
        Relationships: []
      }
      sucursales: {
        Row: {
          activa: boolean
          gestionada_por: string
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          gestionada_por: string
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          gestionada_por?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      tarjetas_debito: {
        Row: {
          activa: boolean
          alias: string | null
          gestora_id: string
          id: string
          tarjeta_habitualista_id: string
          ultimos4: string | null
        }
        Insert: {
          activa?: boolean
          alias?: string | null
          gestora_id: string
          id?: string
          tarjeta_habitualista_id: string
          ultimos4?: string | null
        }
        Update: {
          activa?: boolean
          alias?: string | null
          gestora_id?: string
          id?: string
          tarjeta_habitualista_id?: string
          ultimos4?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarjetas_debito_gestora_id_fkey"
            columns: ["gestora_id"]
            isOneToOne: false
            referencedRelation: "gestoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarjetas_debito_tarjeta_habitualista_id_fkey"
            columns: ["tarjeta_habitualista_id"]
            isOneToOne: false
            referencedRelation: "tarjetas_habitualista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarjetas_debito_tarjeta_habitualista_id_fkey"
            columns: ["tarjeta_habitualista_id"]
            isOneToOne: false
            referencedRelation: "v_saldos"
            referencedColumns: ["tarjeta_id"]
          },
        ]
      }
      tarjetas_habitualista: {
        Row: {
          activa: boolean
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activa?: boolean
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activa?: boolean
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      tramite_cambios: {
        Row: {
          antes: string | null
          campo: string | null
          cuando: string
          despues: string | null
          id: number
          que: string
          quien: string | null
          tramite_id: string
        }
        Insert: {
          antes?: string | null
          campo?: string | null
          cuando?: string
          despues?: string | null
          id?: number
          que: string
          quien?: string | null
          tramite_id: string
        }
        Update: {
          antes?: string | null
          campo?: string | null
          cuando?: string
          despues?: string | null
          id?: number
          que?: string
          quien?: string | null
          tramite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_historial_quien_fkey"
            columns: ["quien"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_historial_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "tramites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_historial_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_esperando_plata"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "presupuesto_historial_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramite_totales"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "presupuesto_historial_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramites"
            referencedColumns: ["id"]
          },
        ]
      }
      tramite_conceptos: {
        Row: {
          anulada: boolean
          concepto_id: string
          creado_at: string
          creado_por: string | null
          id: number
          importe: number
          momento: string
          motivo_anulacion: string | null
          tramite_id: string
        }
        Insert: {
          anulada?: boolean
          concepto_id: string
          creado_at?: string
          creado_por?: string | null
          id?: number
          importe: number
          momento: string
          motivo_anulacion?: string | null
          tramite_id: string
        }
        Update: {
          anulada?: boolean
          concepto_id?: string
          creado_at?: string
          creado_por?: string | null
          id?: number
          importe?: number
          momento?: string
          motivo_anulacion?: string | null
          tramite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tramite_conceptos_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_conceptos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_conceptos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "tramites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_conceptos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_esperando_plata"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "tramite_conceptos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramite_totales"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "tramite_conceptos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramites"
            referencedColumns: ["id"]
          },
        ]
      }
      tramite_eventos: {
        Row: {
          at: string
          estado_desde: string | null
          estado_hasta: string
          id: number
          nota: string | null
          por: string | null
          rol_al_momento: string | null
          tramite_id: string
        }
        Insert: {
          at?: string
          estado_desde?: string | null
          estado_hasta: string
          id?: number
          nota?: string | null
          por?: string | null
          rol_al_momento?: string | null
          tramite_id: string
        }
        Update: {
          at?: string
          estado_desde?: string | null
          estado_hasta?: string
          id?: number
          nota?: string | null
          por?: string | null
          rol_al_momento?: string | null
          tramite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tramite_eventos_por_fkey"
            columns: ["por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_eventos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "tramites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_eventos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_esperando_plata"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "tramite_eventos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramite_totales"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "tramite_eventos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramites"
            referencedColumns: ["id"]
          },
        ]
      }
      tramite_notas: {
        Row: {
          autor: string
          creado_at: string
          id: number
          texto: string
          tramite_id: string
        }
        Insert: {
          autor: string
          creado_at?: string
          id?: number
          texto: string
          tramite_id: string
        }
        Update: {
          autor?: string
          creado_at?: string
          id?: number
          texto?: string
          tramite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tramite_notas_autor_fkey"
            columns: ["autor"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_notas_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "tramites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_notas_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_esperando_plata"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "tramite_notas_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramite_totales"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "tramite_notas_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramites"
            referencedColumns: ["id"]
          },
        ]
      }
      tramite_requisitos: {
        Row: {
          id: number
          nota: string | null
          requisito_id: string
          respondido_at: string
          respondido_por: string | null
          respuesta: string
          tramite_id: string
        }
        Insert: {
          id?: number
          nota?: string | null
          requisito_id: string
          respondido_at?: string
          respondido_por?: string | null
          respuesta: string
          tramite_id: string
        }
        Update: {
          id?: number
          nota?: string | null
          requisito_id?: string
          respondido_at?: string
          respondido_por?: string | null
          respuesta?: string
          tramite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tramite_requisitos_requisito_id_fkey"
            columns: ["requisito_id"]
            isOneToOne: false
            referencedRelation: "requisitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_requisitos_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_requisitos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "tramites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_requisitos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_esperando_plata"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "tramite_requisitos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramite_totales"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "tramite_requisitos_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramites"
            referencedColumns: ["id"]
          },
        ]
      }
      tramites: {
        Row: {
          actualizado_at: string
          actualizado_por: string | null
          administrativo: string | null
          asunto_mail: string | null
          autorizado_en: string
          autorizado_por: string | null
          canal: string
          certificacion_primera_firma: string | null
          cliente_cuenta: string | null
          cliente_nombre: string
          controlado_at: string | null
          creado_at: string
          creado_por: string | null
          deposito_solicitado: number | null
          devuelto_at: string | null
          documentacion_entregada: string | null
          documentacion_retirada: string | null
          dominio: string | null
          entregado_at: string | null
          estado: string
          factura_fecha: string | null
          gestora_id: string | null
          id: string
          medio_pago: string
          motivo_anulacion: string | null
          motivo_frenado: string | null
          numero_pago_registro: string | null
          observaciones: string | null
          observaciones_gestora: string | null
          oferta_referencia: string | null
          origen: string
          pagado_at: string | null
          presentado_at: string | null
          presupuestado_at: string | null
          razon_social_id: string
          recibido_at: string
          resuelto_at: string | null
          retirado_at: string | null
          seccional: string | null
          subtipo: string | null
          sucursal_id: string
          tarjeta_id: string | null
          tipo: string
          vehiculo: string | null
          verificacion_policial: string | null
        }
        Insert: {
          actualizado_at?: string
          actualizado_por?: string | null
          administrativo?: string | null
          asunto_mail?: string | null
          autorizado_en?: string
          autorizado_por?: string | null
          canal?: string
          certificacion_primera_firma?: string | null
          cliente_cuenta?: string | null
          cliente_nombre: string
          controlado_at?: string | null
          creado_at?: string
          creado_por?: string | null
          deposito_solicitado?: number | null
          devuelto_at?: string | null
          documentacion_entregada?: string | null
          documentacion_retirada?: string | null
          dominio?: string | null
          entregado_at?: string | null
          estado?: string
          factura_fecha?: string | null
          gestora_id?: string | null
          id?: string
          medio_pago?: string
          motivo_anulacion?: string | null
          motivo_frenado?: string | null
          numero_pago_registro?: string | null
          observaciones?: string | null
          observaciones_gestora?: string | null
          oferta_referencia?: string | null
          origen?: string
          pagado_at?: string | null
          presentado_at?: string | null
          presupuestado_at?: string | null
          razon_social_id: string
          recibido_at?: string
          resuelto_at?: string | null
          retirado_at?: string | null
          seccional?: string | null
          subtipo?: string | null
          sucursal_id: string
          tarjeta_id?: string | null
          tipo: string
          vehiculo?: string | null
          verificacion_policial?: string | null
        }
        Update: {
          actualizado_at?: string
          actualizado_por?: string | null
          administrativo?: string | null
          asunto_mail?: string | null
          autorizado_en?: string
          autorizado_por?: string | null
          canal?: string
          certificacion_primera_firma?: string | null
          cliente_cuenta?: string | null
          cliente_nombre?: string
          controlado_at?: string | null
          creado_at?: string
          creado_por?: string | null
          deposito_solicitado?: number | null
          devuelto_at?: string | null
          documentacion_entregada?: string | null
          documentacion_retirada?: string | null
          dominio?: string | null
          entregado_at?: string | null
          estado?: string
          factura_fecha?: string | null
          gestora_id?: string | null
          id?: string
          medio_pago?: string
          motivo_anulacion?: string | null
          motivo_frenado?: string | null
          numero_pago_registro?: string | null
          observaciones?: string | null
          observaciones_gestora?: string | null
          oferta_referencia?: string | null
          origen?: string
          pagado_at?: string | null
          presentado_at?: string | null
          presupuestado_at?: string | null
          razon_social_id?: string
          recibido_at?: string
          resuelto_at?: string | null
          retirado_at?: string | null
          seccional?: string | null
          subtipo?: string | null
          sucursal_id?: string
          tarjeta_id?: string | null
          tipo?: string
          vehiculo?: string | null
          verificacion_policial?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tramites_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_gestora_id_fkey"
            columns: ["gestora_id"]
            isOneToOne: false
            referencedRelation: "gestoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_razon_social_id_fkey"
            columns: ["razon_social_id"]
            isOneToOne: false
            referencedRelation: "razones_sociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "tarjetas_habitualista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "v_saldos"
            referencedColumns: ["tarjeta_id"]
          },
        ]
      }
    }
    Views: {
      v_esperando_plata: {
        Row: {
          cliente_nombre: string | null
          dominio: string | null
          falta: number | null
          gestora_id: string | null
          oferta_referencia: string | null
          pide: number | null
          presupuestado_at: string | null
          razon_social_id: string | null
          tarjeta_id: string | null
          tramite_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tramites_gestora_id_fkey"
            columns: ["gestora_id"]
            isOneToOne: false
            referencedRelation: "gestoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_razon_social_id_fkey"
            columns: ["razon_social_id"]
            isOneToOne: false
            referencedRelation: "razones_sociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "tarjetas_habitualista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "v_saldos"
            referencedColumns: ["tarjeta_id"]
          },
        ]
      }
      v_plazos_usables: {
        Row: {
          aplica_a: string | null
          clave: string | null
          consecuencia: string | null
          desde: string | null
          dias: number | null
          habiles: boolean | null
          id: string | null
          nombre: string | null
          norma: string | null
          verificado_el: string | null
          verificado_por: string | null
        }
        Insert: {
          aplica_a?: string | null
          clave?: string | null
          consecuencia?: string | null
          desde?: string | null
          dias?: number | null
          habiles?: boolean | null
          id?: string | null
          nombre?: string | null
          norma?: string | null
          verificado_el?: string | null
          verificado_por?: string | null
        }
        Update: {
          aplica_a?: string | null
          clave?: string | null
          consecuencia?: string | null
          desde?: string | null
          dias?: number | null
          habiles?: boolean | null
          id?: string | null
          nombre?: string | null
          norma?: string | null
          verificado_el?: string | null
          verificado_por?: string | null
        }
        Relationships: []
      }
      v_saldos: {
        Row: {
          comprometido: number | null
          contable: number | null
          en_transito: number | null
          movimientos_visibles: number | null
          nombre: string | null
          orden: number | null
          tarjeta_id: string | null
        }
        Relationships: []
      }
      v_tramite_notas: {
        Row: {
          autor: string | null
          autor_nombre: string | null
          creado_at: string | null
          id: number | null
          texto: string | null
          tramite_id: string | null
        }
        Insert: {
          autor?: string | null
          autor_nombre?: never
          creado_at?: string | null
          id?: number | null
          texto?: string | null
          tramite_id?: string | null
        }
        Update: {
          autor?: string | null
          autor_nombre?: never
          creado_at?: string | null
          id?: number | null
          texto?: string | null
          tramite_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tramite_notas_autor_fkey"
            columns: ["autor"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_notas_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "tramites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramite_notas_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_esperando_plata"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "tramite_notas_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramite_totales"
            referencedColumns: ["tramite_id"]
          },
          {
            foreignKeyName: "tramite_notas_tramite_id_fkey"
            columns: ["tramite_id"]
            isOneToOne: false
            referencedRelation: "v_tramites"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tramite_totales: {
        Row: {
          total_presupuesto: number | null
          total_real: number | null
          tramite_id: string | null
        }
        Relationships: []
      }
      v_tramites: {
        Row: {
          actualizado_at: string | null
          actualizado_por: string | null
          asunto_mail: string | null
          autorizado_en: string | null
          autorizado_por: string | null
          canal: string | null
          cliente_cuenta: string | null
          cliente_nombre: string | null
          controlado_at: string | null
          creado_at: string | null
          creado_por: string | null
          deposito_solicitado: number | null
          devuelto_at: string | null
          documentacion_entregada: string | null
          documentacion_retirada: string | null
          dominio: string | null
          entregado_at: string | null
          estado: string | null
          gestora_id: string | null
          id: string | null
          medio_pago: string | null
          monto_cobrado: number | null
          motivo_anulacion: string | null
          motivo_frenado: string | null
          numero_pago_registro: string | null
          observaciones: string | null
          observaciones_gestora: string | null
          oferta_referencia: string | null
          origen: string | null
          pagado_at: string | null
          presentado_at: string | null
          presupuestado_at: string | null
          razon_social_id: string | null
          recibido_at: string | null
          retirado_at: string | null
          seccional: string | null
          subtipo: string | null
          sucursal_id: string | null
          tarjeta_id: string | null
          tipo: string | null
          vehiculo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tramites_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_gestora_id_fkey"
            columns: ["gestora_id"]
            isOneToOne: false
            referencedRelation: "gestoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_razon_social_id_fkey"
            columns: ["razon_social_id"]
            isOneToOne: false
            referencedRelation: "razones_sociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "tarjetas_habitualista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "v_saldos"
            referencedColumns: ["tarjeta_id"]
          },
        ]
      }
    }
    Functions: {
      anular_movimiento: {
        Args: { p_id: number; p_motivo: string }
        Returns: number
      }
      conciliar_tramite: {
        Args: { p_motivo?: string; p_tramite: string }
        Returns: undefined
      }
      es_contable: { Args: never; Returns: boolean }
      es_gerencia: { Args: never; Returns: boolean }
      es_gestora: { Args: never; Returns: boolean }
      es_oficina: { Args: never; Returns: boolean }
      hoy_argentina: { Args: never; Returns: string }
      mi_gestora_id: { Args: never; Returns: string }
      mi_rol: { Args: never; Returns: string }
      nombre_de: { Args: { persona: string }; Returns: string }
      nombres_de: {
        Args: { personas: string[] }
        Returns: {
          id: string
          nombre: string
        }[]
      }
      opero_esta_tarjeta: { Args: { p_tarjeta: string }; Returns: boolean }
      orden_estado: { Args: { p: string }; Returns: number }
      puede_ver_cobros: { Args: never; Returns: boolean }
      tengo_tramite_en_esta_tarjeta: {
        Args: { p_tarjeta: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

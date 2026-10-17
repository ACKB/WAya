export const aiTools = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Consulta los horarios disponibles para un servicio específico considerando su duración (en minutos).',
      parameters: {
        type: 'object',
        properties: {
          serviceName: {
            type: 'string',
            description: 'El tratamiento o servicio solicitado (ej. tinte, corte dama, manicure).'
          },
          date: {
            type: 'string',
            description: 'Fecha específica a consultar en formato YYYY-MM-DD (opcional si es para los próximos días).'
          }
        },
        required: ['serviceName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Agenda y confirma definitivamente una cita en el calendario del negocio.',
      parameters: {
        type: 'object',
        properties: {
          serviceName: {
            type: 'string',
            description: 'El nombre del servicio o tratamiento (ej. tinte, corte dama).'
          },
          date: {
            type: 'string',
            description: 'Fecha de la cita en formato YYYY-MM-DD (ej. 2026-10-19).'
          },
          time: {
            type: 'string',
            description: 'Hora de inicio de la cita en formato militar 24h HH:mm (ej. 08:30, 15:00).'
          },
          customerName: {
            type: 'string',
            description: 'Nombre de la persona que asistirá a la cita.'
          }
        },
        required: ['serviceName', 'date', 'time', 'customerName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_services',
      description: 'Lista los servicios disponibles en el negocio junto con su duración y precio.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_customer_name',
      description: 'Guarda o actualiza el nombre del cliente en la base de datos para no volvérselo a preguntar en el futuro.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'El nombre de pila o nombre completo del cliente (ej. María).'
          }
        },
        required: ['name']
      }
    }
  }
];

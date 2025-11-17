import axios, { AxiosInstance } from 'axios';
import https from 'node:https';
import { config } from './config';

// Configurar agente HTTPS que ignora certificados autofirmados (solo para desarrollo)
const httpsAgent = new https.Agent({
  rejectUnauthorized: !config.allowInsecureTls,
});

export interface MenderDevice {
  id: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'preauthorized';
  created_ts?: string;
  updated_ts?: string;
  auth_sets?: Array<{
    id: string;
    pubkey: string;
    status: string;
  }>;
  attributes?: Array<{
    name: string;
    value: string;
    scope: string;
  }>;
  // Para compatibilidad con diferentes formatos de API
  [key: string]: any;
}

export interface MenderDeviceStatus {
  deviceId: string;
  status: string;
  healthy: boolean;
  lastSeen?: string;
  created?: string;
  attributes?: Record<string, string>;
  healthReason?: string;
  timeSinceUpdate?: number;
  timeSinceUpdateFormatted?: string;
}

/**
 * Cliente para interactuar con la API de Mender
 */
export class MenderClient {
  private client: AxiosInstance;

  constructor() {
    if (!config.mender.enabled) {
      throw new Error('Mender no está habilitado. Configura MENDER_SERVER_URL y MENDER_API_TOKEN.');
    }

    // La API de Mender.io (tanto online como propia) usa la misma estructura
    const baseURL = `${config.mender.serverUrl}/api/management/v1`;

    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${config.mender.apiToken}`,
        'Content-Type': 'application/json',
      },
      httpsAgent,
      timeout: 15000, // Timeout de 15 segundos para Mender.io online
    });
  }

  /**
   * Obtiene información de un dispositivo específico
   * @param deviceId ID del dispositivo
   * @returns Información del dispositivo o null si no se encuentra
   */
  async getDevice(deviceId: string): Promise<MenderDevice | null> {
    try {
      // Para Mender.io online, la ruta es /inventory/devices/:id
      const response = await this.client.get<MenderDevice>(`/inventory/devices/${deviceId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error obteniendo dispositivo ${deviceId} de Mender:`, error.message);
      throw error;
    }
  }

  /**
   * Lista todos los dispositivos
   * @returns Lista de dispositivos
   */
  async listDevices(): Promise<MenderDevice[]> {
    try {
      // Para Mender.io online, la ruta es /inventory/devices
      const response = await this.client.get<MenderDevice[]>('/inventory/devices');
      return response.data || [];
    } catch (error: any) {
      console.error('Error listando dispositivos de Mender:', error.message);
      throw error;
    }
  }

  /**
   * Formatea el tiempo transcurrido en formato legible
   */
  private formatTimeAgo(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return `${seconds} segundo${seconds > 1 ? 's' : ''}`;
  }

  /**
   * Verifica el estado de un dispositivo
   * @param deviceId ID del dispositivo
   * @returns Estado del dispositivo con información diagnóstica
   */
  async checkDeviceStatus(deviceId: string): Promise<MenderDeviceStatus> {
    try {
      const device = await this.getDevice(deviceId);
      
      if (!device) {
        return {
          deviceId,
          status: 'not_found',
          healthy: false,
          healthReason: 'Dispositivo no encontrado en Mender',
        };
      }

      // Extraer atributos en un formato más fácil de usar primero
      const attributes: Record<string, string> = {};
      if (device.attributes) {
        device.attributes.forEach(attr => {
          attributes[attr.name] = attr.value;
        });
      }

      // En Mender.io online, el status puede estar en los atributos o en el nivel superior
      const deviceStatus = device.status || attributes.status || 'unknown';
      console.log(`[checkDeviceStatus] Dispositivo ${device.id}: device.status=${device.status}, attributes.status=${attributes.status}, deviceStatus final=${deviceStatus}`);
      
      // También extraer created_ts y updated_ts de atributos si no están en el nivel superior
      const createdTs = device.created_ts || attributes.created_ts;
      const updatedTs = device.updated_ts || attributes.updated_ts;

      if (!updatedTs) {
        console.log(`[checkDeviceStatus] Dispositivo ${device.id}: No se pudo determinar updatedTs`);
        return {
          deviceId: device.id,
          status: deviceStatus,
          healthy: false,
          healthReason: 'No se pudo determinar la última actualización del dispositivo',
          attributes,
        };
      }

      // Calcular tiempo desde última actualización
      const updatedTsNum = new Date(updatedTs).getTime();
      const createdTsNum = createdTs ? new Date(createdTs).getTime() : null;
      const now = Date.now();
      const timeSinceUpdate = now - updatedTsNum;
      const timeSinceUpdateFormatted = this.formatTimeAgo(timeSinceUpdate);

      // Un dispositivo se considera saludable si está aceptado y actualizado recientemente
      const isAccepted = deviceStatus === 'accepted';
      const recentlyUpdated = timeSinceUpdate < 24 * 60 * 60 * 1000; // Últimas 24 horas
      const healthy = isAccepted && recentlyUpdated;
      
      console.log(`[checkDeviceStatus] Dispositivo ${device.id}: isAccepted=${isAccepted}, recentlyUpdated=${recentlyUpdated}, healthy=${healthy}`);

      // Determinar razón de no saludable
      let healthReason: string | undefined;
      if (!healthy) {
        const reasons: string[] = [];
        if (!isAccepted) {
          reasons.push(`Estado: ${deviceStatus} (requiere estar "accepted")`);
        }
        if (!recentlyUpdated) {
          reasons.push(`Última actualización hace ${timeSinceUpdateFormatted} (requiere menos de 24 horas)`);
        }
        healthReason = reasons.join('; ');
      }

      return {
        deviceId: device.id,
        status: deviceStatus,
        healthy,
        lastSeen: updatedTs,
        created: createdTs || undefined,
        attributes,
        healthReason,
        timeSinceUpdate,
        timeSinceUpdateFormatted,
      };
    } catch (error: any) {
      console.error(`Error verificando estado del dispositivo ${deviceId}:`, error.message);
      return {
        deviceId,
        status: 'error',
        healthy: false,
        healthReason: `Error al obtener información: ${error.message}`,
      };
    }
  }

  /**
   * Verifica si el servidor de Mender está disponible
   * @returns true si el servidor está disponible
   */
  async checkServerHealth(): Promise<boolean> {
    try {
      // Intentar obtener la lista de dispositivos como verificación de salud
      // Usar la ruta correcta de inventory
      await this.client.get('/inventory/devices', { timeout: 5000 });
      return true;
    } catch (error: any) {
      // Si es 404, puede ser que la ruta sea diferente o que no haya dispositivos
      // Si es 401/403, el token es inválido
      // Si es otro error, el servidor puede estar disponible pero con problemas
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('Error de autenticación con Mender:', error.response?.status);
        return false;
      }
      // Para otros errores (incluyendo 404), asumimos que el servidor está disponible
      // pero puede haber un problema con la ruta o configuración
      console.warn('Advertencia verificando salud del servidor Mender:', error.response?.status || error.message);
      return true; // Asumimos que está disponible si no es error de auth
    }
  }
}

/**
 * Instancia singleton del cliente Mender
 */
let menderClientInstance: MenderClient | null = null;

/**
 * Obtiene la instancia del cliente Mender
 * @returns Cliente Mender o null si no está configurado
 */
export const getMenderClient = (): MenderClient | null => {
  if (!config.mender.enabled) {
    return null;
  }

  if (!menderClientInstance) {
    try {
      menderClientInstance = new MenderClient();
    } catch (error) {
      console.error('Error inicializando cliente Mender:', error);
      return null;
    }
  }

  return menderClientInstance;
};


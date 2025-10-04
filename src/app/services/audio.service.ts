// src/app/services/audio.service.ts
// ✅ VERSIÓN CORREGIDA - MANEJO DE ERRORES Y TIMEOUT

import { Injectable } from '@angular/core';

export interface AudioMessage {
  text: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  category: 'error' | 'success' | 'info' | 'readiness';
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private isEnabled = true;
  private isSpeaking = false;
  private messageQueue: AudioMessage[] = [];
  private lastAudioTime = 0;
  private lastReadinessTime = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentTimeoutId: any = null; // ✅ NUEVO: Para limpiar timeout
  
  // ⏰ COOLDOWNS
  private readonly AUDIO_COOLDOWN = 2500;
  private readonly READINESS_COOLDOWN = 4000;
  private readonly AUDIO_TIMEOUT = 5000; // ✅ NUEVO: 5 segundos máximo

  // 🎚️ CONFIGURACIONES
  private audioConfig = {
    rate: 0.9,
    pitch: 1.0,
    volume: 1.0,
    language: 'es-ES'
  };

  constructor() {
    console.log('🎤 AudioService inicializado - VERSIÓN CORREGIDA');
    this.initializeAudio();
  }

  private initializeAudio(): void {
    try {
      if (!window.speechSynthesis) {
        console.warn('⚠️ SpeechSynthesis no disponible');
        this.isEnabled = false;
        return;
      }

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          console.log('✅ Voces cargadas:', window.speechSynthesis.getVoices().length);
        };
      }

      console.log('✅ AudioService configurado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando audio:', error);
      this.isEnabled = false;
    }
  }

  // ============================================================================
  // ✅ MÉTODO PRINCIPAL DE HABLA - CON MANEJO DE ERRORES
  // ============================================================================

  async speak(
    message: string, 
    category: AudioMessage['category'] = 'info', 
    priority: AudioMessage['priority'] = 'normal'
  ): Promise<void> {
    if (!this.isEnabled || !message || message.trim() === '') {
      return;
    }

    if (!this.checkCooldown(category)) {
      console.log('⏸️ Audio en cooldown, ignorando:', message.substring(0, 30));
      return;
    }

    const audioMessage: AudioMessage = { text: message, priority, category };

    if (priority === 'critical') {
      this.stopCurrentAudio();
      await this.speakMessage(audioMessage);
    } else if (this.isSpeaking) {
      if (priority === 'high') {
        this.messageQueue.unshift(audioMessage);
      } else {
        this.messageQueue.push(audioMessage);
      }
    } else {
      await this.speakMessage(audioMessage);
    }

    this.updateLastAudioTime(category);
  }

  // ✅ NUEVO: Método con manejo completo de errores y timeout
  private async speakMessage(message: AudioMessage): Promise<void> {
    if (!this.isEnabled || !window.speechSynthesis) {
      this.resetSpeakingState();
      return;
    }

    return new Promise((resolve) => {
      this.isSpeaking = true;
      
      const utterance = new SpeechSynthesisUtterance(message.text);
      utterance.rate = this.audioConfig.rate;
      utterance.pitch = this.audioConfig.pitch;
      utterance.volume = this.audioConfig.volume;
      utterance.lang = this.audioConfig.language;

      // ✅ TIMEOUT DE SEGURIDAD
      this.currentTimeoutId = setTimeout(() => {
        console.warn('⏱️ Audio timeout después de 5 segundos, forzando limpieza');
        window.speechSynthesis.cancel();
        this.resetSpeakingState();
        resolve();
      }, this.AUDIO_TIMEOUT);

      // ✅ EVENTO: Audio terminó correctamente
      utterance.onend = () => {
        console.log('✅ Audio completado:', message.text.substring(0, 30));
        this.clearCurrentTimeout();
        this.resetSpeakingState();
        this.processQueue();
        resolve();
      };

      // ✅ EVENTO: Error en audio
      utterance.onerror = (event) => {
        console.error('❌ Error en audio:', event.error, message.text.substring(0, 30));
        this.clearCurrentTimeout();
        this.resetSpeakingState();
        this.processQueue();
        resolve();
      };

      // ✅ EVENTO: Audio iniciado
      utterance.onstart = () => {
        console.log('🎤 Audio iniciado:', message.text.substring(0, 30));
      };

      // ✅ EVENTO: Audio pausado
      utterance.onpause = () => {
        console.log('⏸️ Audio pausado');
      };

      // ✅ EVENTO: Audio resumido
      utterance.onresume = () => {
        console.log('▶️ Audio resumido');
      };

      this.currentUtterance = utterance;
      
      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('❌ Error ejecutando speechSynthesis.speak:', error);
        this.clearCurrentTimeout();
        this.resetSpeakingState();
        resolve();
      }
    });
  }

  // ✅ NUEVO: Resetear estado de forma segura
  private resetSpeakingState(): void {
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  // ✅ NUEVO: Limpiar timeout actual
  private clearCurrentTimeout(): void {
    if (this.currentTimeoutId) {
      clearTimeout(this.currentTimeoutId);
      this.currentTimeoutId = null;
    }
  }

  // ⏸️ DETENER AUDIO ACTUAL
  stopCurrentAudio(): void {
    try {
      this.clearCurrentTimeout();
      
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      this.resetSpeakingState();
      console.log('🛑 Audio detenido');
    } catch (error) {
      console.error('❌ Error deteniendo audio:', error);
      this.resetSpeakingState();
    }
  }

  // 📤 PROCESAR COLA DE MENSAJES
  private async processQueue(): Promise<void> {
    if (this.messageQueue.length > 0 && !this.isSpeaking) {
      const nextMessage = this.messageQueue.shift();
      if (nextMessage) {
        await this.speakMessage(nextMessage);
      }
    }
  }

  // ⏰ VERIFICAR COOLDOWN
  private checkCooldown(category: AudioMessage['category']): boolean {
    const now = Date.now();
    
    if (category === 'readiness') {
      return (now - this.lastReadinessTime) >= this.READINESS_COOLDOWN;
    } else {
      return (now - this.lastAudioTime) >= this.AUDIO_COOLDOWN;
    }
  }

  // ⏰ ACTUALIZAR TIEMPO DE ÚLTIMO AUDIO
  private updateLastAudioTime(category: AudioMessage['category']): void {
    const now = Date.now();
    
    if (category === 'readiness') {
      this.lastReadinessTime = now;
    } else {
      this.lastAudioTime = now;
    }
  }

  // 🎚️ MÉTODOS DE CONFIGURACIÓN Y ESTADO
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stopCurrentAudio();
      this.messageQueue = [];
    }
    console.log('🎤 Audio', enabled ? 'ACTIVADO' : 'DESACTIVADO');
  }

  isAudioEnabled(): boolean {
    return this.isEnabled;
  }

  isCurrentlyPlaying(): boolean {
    return this.isSpeaking;
  }

  setVolume(volume: number): void {
    this.audioConfig.volume = Math.max(0, Math.min(1, volume));
  }

  setRate(rate: number): void {
    this.audioConfig.rate = Math.max(0.5, Math.min(2, rate));
  }

  // 🎤 MÉTODOS DE CONVENIENCIA
  async speakError(message: string): Promise<void> {
    await this.speak(message, 'error', 'high');
  }

  async speakSuccess(message: string): Promise<void> {
    await this.speak(message, 'success', 'normal');
  }

  async speakCritical(message: string): Promise<void> {
    await this.speak(message, 'error', 'critical');
  }

  async speakReadiness(message: string): Promise<void> {
    await this.speak(message, 'readiness', 'normal');
  }

  // 🧹 LIMPIEZA
  cleanup(): void {
    this.clearCurrentTimeout();
    this.stopCurrentAudio();
    this.messageQueue = [];
    this.resetSpeakingState();
    console.log('🧹 AudioService limpiado');
  }
}
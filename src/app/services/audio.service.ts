// src/app/services/audio.service.ts
// ✅ VERSIÓN NATIVA - COMPATIBLE CON ANDROID Y NAVEGADOR

import { Injectable } from '@angular/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

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
  private isNativePlatform = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentTimeoutId: any = null;

  // ⏰ COOLDOWNS
  private readonly AUDIO_COOLDOWN = 2500;
  private readonly READINESS_COOLDOWN = 4000;
  private readonly AUDIO_TIMEOUT = 5000;

  // 🎚️ CONFIGURACIONES
  private audioConfig = {
    rate: 0.9,
    pitch: 0.7,
    volume: 1.0,
    language: 'es-ES'
  };

  constructor() {
    this.isNativePlatform = Capacitor.isNativePlatform();
    console.log('🎤 AudioService inicializado - MODO:', this.isNativePlatform ? 'NATIVO' : 'WEB');
    this.initializeAudio();
  }

  private async initializeAudio(): Promise<void> {
    try {
      if (this.isNativePlatform) {
        // Verificar disponibilidad del plugin nativo
        const available = await TextToSpeech.isLanguageSupported({ lang: this.audioConfig.language });
        console.log('✅ Text-to-Speech nativo disponible:', available.supported);
        this.isEnabled = available.supported;
      } else {
        // Modo navegador (desarrollo)
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

        console.log('✅ AudioService configurado correctamente (modo web)');
      }
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

  // ✅ MÉTODO PRINCIPAL: Usa plugin nativo o Web API según plataforma
  private async speakMessage(message: AudioMessage): Promise<void> {
    if (!this.isEnabled) {
      this.resetSpeakingState();
      return;
    }

    this.isSpeaking = true;

    if (this.isNativePlatform) {
      // ========== MODO NATIVO (Android/iOS) ==========
      await this.speakNative(message);
    } else {
      // ========== MODO WEB (Navegador) ==========
      await this.speakWeb(message);
    }
  }

  // 📱 MODO NATIVO: Usa plugin de Capacitor
  private async speakNative(message: AudioMessage): Promise<void> {
    try {
      console.log('🎤 Audio nativo iniciado:', message.text.substring(0, 30));

      await TextToSpeech.speak({
        text: message.text,
        lang: this.audioConfig.language,
        rate: this.audioConfig.rate,
        pitch: this.audioConfig.pitch,
        volume: this.audioConfig.volume,
        category: 'ambient'
      });

      console.log('✅ Audio nativo completado');
      this.resetSpeakingState();
      this.processQueue();

    } catch (error) {
      console.error('❌ Error en audio nativo:', error);
      this.resetSpeakingState();
      this.processQueue();
    }
  }

  // 🌐 MODO WEB: Usa Web Speech API
  private async speakWeb(message: AudioMessage): Promise<void> {
    if (!window.speechSynthesis) {
      this.resetSpeakingState();
      return;
    }

    return new Promise((resolve) => {
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
        console.log('✅ Audio web completado:', message.text.substring(0, 30));
        this.clearCurrentTimeout();
        this.resetSpeakingState();
        this.processQueue();
        resolve();
      };

      // ✅ EVENTO: Error en audio
      utterance.onerror = (event) => {
        console.error('❌ Error en audio web:', event.error, message.text.substring(0, 30));
        this.clearCurrentTimeout();
        this.resetSpeakingState();
        this.processQueue();
        resolve();
      };

      // ✅ EVENTO: Audio iniciado
      utterance.onstart = () => {
        console.log('🎤 Audio web iniciado:', message.text.substring(0, 30));
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
  async stopCurrentAudio(): Promise<void> {
    try {
      this.clearCurrentTimeout();

      if (this.isNativePlatform) {
        // Detener audio nativo
        await TextToSpeech.stop();
      } else if (window.speechSynthesis) {
        // Detener audio web
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
  async setEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;
    if (!enabled) {
      await this.stopCurrentAudio();
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
  async cleanup(): Promise<void> {
    this.clearCurrentTimeout();
    await this.stopCurrentAudio();
    this.messageQueue = [];
    this.resetSpeakingState();
    console.log('🧹 AudioService limpiado');
  }
}
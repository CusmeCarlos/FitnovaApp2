// src/app/services/audio.service.ts
// 🎤 AUDIO SERVICE SIMPLE - SIN DEPENDENCIAS EXTERNAS

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
  
  // ⏰ COOLDOWNS PARA EVITAR SPAM
  private readonly AUDIO_COOLDOWN = 2500; // 2.5 segundos
  private readonly READINESS_COOLDOWN = 4000; // 4 segundos

  // 🎚️ CONFIGURACIONES DE AUDIO
  private audioConfig = {
    rate: 0.9,
    pitch: 1.0,
    volume: 1.0,
    language: 'es-ES'
  };

  constructor() {
    console.log('🎤 AudioService inicializado');
    this.initializeAudio();
  }

  // 🔧 INICIALIZAR SISTEMA DE AUDIO
  private initializeAudio(): void {
    try {
      if (!window.speechSynthesis) {
        console.warn('⚠️ SpeechSynthesis no disponible');
        this.isEnabled = false;
        return;
      }

      // Esperar a que las voces se carguen
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          console.log('✅ Voces cargadas:', window.speechSynthesis.getVoices().length);
        };
      }

      console.log('✅ AudioService configurado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando AudioService:', error);
      this.isEnabled = false;
    }
  }

  // 🎤 MÉTODO PRINCIPAL PARA REPRODUCIR AUDIO
  async speak(message: string, category: AudioMessage['category'] = 'info', priority: AudioMessage['priority'] = 'normal'): Promise<void> {
    if (!this.isEnabled || !message.trim()) {
      return;
    }

    const audioMessage: AudioMessage = {
      text: message.trim(),
      priority,
      category
    };

    // 🚨 MENSAJES CRÍTICOS = INMEDIATOS
    if (priority === 'critical') {
      await this.speakImmediately(audioMessage);
      return;
    }

    // ⏰ VERIFICAR COOLDOWN
    if (!this.checkCooldown(category)) {
      console.log('⏸️ Audio en cooldown, saltando:', message);
      return;
    }

    // 🔊 REPRODUCIR O ENCOLAR
    if (this.isSpeaking && priority !== 'high') {
      this.messageQueue.push(audioMessage);
      console.log('📤 Audio encolado:', message);
    } else {
      await this.speakMessage(audioMessage);
    }
  }

  // 🚨 REPRODUCIR MENSAJE CRÍTICO INMEDIATAMENTE
  private async speakImmediately(message: AudioMessage): Promise<void> {
    try {
      // Cancelar audio actual si existe
      this.stopCurrentAudio();
      
      // Limpiar cola
      this.messageQueue = [];
      
      // Reproducir inmediatamente
      await this.speakMessage(message);
      
    } catch (error) {
      console.error('❌ Error en speakImmediately:', error);
    }
  }

  // 🔊 REPRODUCIR MENSAJE
  private async speakMessage(message: AudioMessage): Promise<void> {
    if (!window.speechSynthesis) {
      console.warn('⚠️ SpeechSynthesis no disponible');
      return;
    }

    try {
      this.isSpeaking = true;
      this.updateLastAudioTime(message.category);

      // Crear utterance
      const utterance = new SpeechSynthesisUtterance(message.text);
      utterance.rate = this.audioConfig.rate;
      utterance.pitch = this.audioConfig.pitch;
      utterance.volume = this.audioConfig.volume;
      utterance.lang = this.audioConfig.language;

      // Configurar eventos
      utterance.onstart = () => {
        console.log('🔊 Audio iniciado:', message.text);
      };

      utterance.onend = () => {
        console.log('✅ Audio completado');
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.processQueue();
      };

      utterance.onerror = (event) => {
        console.error('❌ Error en audio:', event);
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.processQueue();
      };

      // Buscar voz en español
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(voice => 
        voice.lang.includes('es') || voice.name.includes('Spanish')
      );
      
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      // Reproducir
      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('❌ Error reproduciendo audio:', error);
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.processQueue();
    }
  }

  // ⏸️ DETENER AUDIO ACTUAL
  stopCurrentAudio(): void {
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      this.isSpeaking = false;
      this.currentUtterance = null;
    } catch (error) {
      console.error('❌ Error deteniendo audio:', error);
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

  // ✅ NUEVO: Método para verificar si está reproduciendo
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
    this.stopCurrentAudio();
    this.messageQueue = [];
    this.isSpeaking = false;
  }

  // 📱 MÉTODO PARA FUTURA INTEGRACIÓN NATIVA
  // (Se puede expandir cuando se instale el plugin de Capacitor)
  private isNativePlatform(): boolean {
    // Por ahora siempre falso, se puede detectar con Capacitor más tarde
    return false;
  }
}
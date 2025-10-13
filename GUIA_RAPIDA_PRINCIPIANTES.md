# 🚀 Guía Rápida - Sistema para Principiantes

## 👶 4 EJERCICIOS NIVEL PRINCIPIANTE

| Ejercicio | Detección | Nivel |
|-----------|-----------|-------|
| Sentadillas | SQUATS | 👶 Principiante |
| Peso Muerto | DEADLIFTS | 👶 Principiante |
| Zancadas | LUNGES | 👶 Principiante |
| Remo con Barra | BARBELL_ROW | 👶 Principiante |

---

## 🚀 IMPLEMENTACIÓN (10 min)

### 1. Inicializar BD
```bash
cd functions
node init-exercises.js
```

**Salida:**
```
✅ Sentadillas → SQUATS [BEGINNER]
✅ Peso Muerto Libre → DEADLIFTS [BEGINNER]
✅ Zancadas → LUNGES [BEGINNER]
✅ Remo con Barra → BARBELL_ROW [BEGINNER]

📊 RESUMEN: 4 ejercicios PRINCIPIANTES agregados
```

### 2. Redeploy Functions
```bash
firebase deploy --only functions
```

### 3. Probar
```bash
ionic serve
```

---

## ✅ VERIFICAR

En Tab2 debes ver:
- ✅ Exactamente 4 ejercicios
- ✅ Todos nivel principiante
- ✅ Console: "4 ejercicios cargados"

---

## 🎓 ADAPTACIONES

Cada ejercicio tiene modificaciones para principiantes:
- **Sentadillas**: Profundidad reducida, apoyo opcional
- **Peso Muerto**: Sin peso, solo técnica
- **Zancadas**: Pasos cortos, con apoyo
- **Remo**: Sin peso, práctica del movimiento

GPT generará rutinas apropiadas automáticamente.

---

**Tiempo total: 10 minutos** 🎉

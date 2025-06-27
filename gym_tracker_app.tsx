import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Check, Download, Clock, Dumbbell, Target } from 'lucide-react';

const GymTracker = () => {
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [workoutData, setWorkoutData] = useState({});
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentExercise, setCurrentExercise] = useState(null);
  const [sessionStats, setSessionStats] = useState({});
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const workouts = {
    A: {
      name: "Petto, Spalle, Tricipiti",
      exercises: [
        { name: "Panca Piana con Bilanciere", sets: 4, reps: "8-10", rest: 150, muscle: "Petto" },
        { name: "Panca Inclinata 30° Manubri", sets: 3, reps: "10-12", rest: 120, muscle: "Petto" },
        { name: "Croci ai Cavi Alti", sets: 3, reps: "12-15", rest: 90, muscle: "Petto" },
        { name: "Military Press in Piedi", sets: 4, reps: "8-10", rest: 150, muscle: "Spalle" },
        { name: "Alzate Laterali", sets: 3, reps: "12-15", rest: 90, muscle: "Spalle" },
        { name: "Alzate Posteriori ai Cavi", sets: 3, reps: "15-18", rest: 75, muscle: "Spalle" },
        { name: "French Press", sets: 3, reps: "10-12", rest: 105, muscle: "Tricipiti" },
        { name: "Tricipiti ai Cavi", sets: 3, reps: "12-15", rest: 90, muscle: "Tricipiti" },
        { name: "Plank", sets: 3, reps: "45-60 sec", rest: 60, muscle: "Core" }
      ]
    },
    B: {
      name: "Dorso, Bicipiti",
      exercises: [
        { name: "Trazioni Assistite/Lat Machine", sets: 4, reps: "8-10", rest: 150, muscle: "Dorso" },
        { name: "Rematore con Bilanciere", sets: 4, reps: "8-10", rest: 150, muscle: "Dorso" },
        { name: "Pulley Basso", sets: 3, reps: "10-12", rest: 120, muscle: "Dorso" },
        { name: "Rematore Unilaterale Manubrio", sets: 3, reps: "10-12 cad", rest: 105, muscle: "Dorso" },
        { name: "Pullover Manubrio", sets: 3, reps: "12-15", rest: 90, muscle: "Dorso" },
        { name: "Curl Bilanciere", sets: 4, reps: "10-12", rest: 105, muscle: "Bicipiti" },
        { name: "Curl Martello", sets: 3, reps: "12-15", rest: 90, muscle: "Bicipiti" },
        { name: "Curl ai Cavi", sets: 3, reps: "12-15", rest: 75, muscle: "Bicipiti" },
        { name: "Russian Twist", sets: 3, reps: "20 cad lato", rest: 60, muscle: "Core" }
      ]
    },
    C: {
      name: "Gambe, Glutei, Addome",
      exercises: [
        { name: "Squat con Bilanciere", sets: 4, reps: "8-10", rest: 180, muscle: "Gambe" },
        { name: "Pressa 45°", sets: 3, reps: "12-15", rest: 150, muscle: "Gambe" },
        { name: "Stacchi Rumeni", sets: 4, reps: "10-12", rest: 150, muscle: "Gambe" },
        { name: "Leg Curl", sets: 3, reps: "12-15", rest: 105, muscle: "Gambe" },
        { name: "Leg Extension", sets: 3, reps: "12-15", rest: 105, muscle: "Gambe" },
        { name: "Hip Thrust", sets: 3, reps: "12-15", rest: 105, muscle: "Glutei" },
        { name: "Calf in Piedi", sets: 4, reps: "15-20", rest: 90, muscle: "Polpacci" },
        { name: "Crunch", sets: 3, reps: "15-20", rest: 60, muscle: "Core" },
        { name: "Mountain Climbers", sets: 3, reps: "30 sec", rest: 45, muscle: "Core" },
        { name: "Dead Bug", sets: 3, reps: "10 cad lato", rest: 60, muscle: "Core" }
      ]
    }
  };

  useEffect(() => {
    if (isTimerRunning && timer > 0) {
      timerRef.current = setTimeout(() => {
        setTimer(timer - 1);
      }, 1000);
    } else if (timer === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      playNotification();
    }
    return () => clearTimeout(timerRef.current);
  }, [timer, isTimerRunning]);

  const playNotification = () => {
    // Create audio notification
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.frequency.setValueAtTime(800, context.currentTime);
    gainNode.gain.setValueAtTime(0.3, context.currentTime);
    
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
    
    setTimeout(() => {
      alert("⏰ Tempo di riposo terminato! Inizia la prossima serie.");
    }, 100);
  };

  const startWorkout = (workoutKey) => {
    setSelectedWorkout(workoutKey);
    const initialData = {};
    workouts[workoutKey].exercises.forEach((exercise, idx) => {
      initialData[idx] = {
        completedSets: 0,
        weights: Array(exercise.sets).fill(''),
        reps: Array(exercise.sets).fill('')
      };
    });
    setWorkoutData(initialData);
    setSessionStats({
      startTime: new Date(),
      workoutType: workoutKey,
      exercises: []
    });
  };

  const completeSet = (exerciseIdx, setIdx, weight, reps) => {
    const newData = { ...workoutData };
    if (!newData[exerciseIdx]) {
      newData[exerciseIdx] = {
        completedSets: 0,
        weights: Array(workouts[selectedWorkout].exercises[exerciseIdx].sets).fill(''),
        reps: Array(workouts[selectedWorkout].exercises[exerciseIdx].sets).fill('')
      };
    }
    
    newData[exerciseIdx].weights[setIdx] = weight;
    newData[exerciseIdx].reps[setIdx] = reps;
    newData[exerciseIdx].completedSets = Math.max(newData[exerciseIdx].completedSets, setIdx + 1);
    
    setWorkoutData(newData);
    
    // Start rest timer
    const restTime = workouts[selectedWorkout].exercises[exerciseIdx].rest;
    setTimer(restTime);
    setIsTimerRunning(true);
    setCurrentExercise(exerciseIdx);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCompletedSetsForMuscle = (muscle) => {
    if (!selectedWorkout) return { completed: 0, total: 0 };
    
    const exercises = workouts[selectedWorkout].exercises.filter(ex => ex.muscle === muscle);
    let completed = 0, total = 0;
    
    exercises.forEach((exercise, globalIdx) => {
      const exerciseIdx = workouts[selectedWorkout].exercises.findIndex(ex => ex.name === exercise.name);
      total += exercise.sets;
      if (workoutData[exerciseIdx]) {
        completed += workoutData[exerciseIdx].completedSets;
      }
    });
    
    return { completed, total };
  };

  const getMuscleGroups = () => {
    if (!selectedWorkout) return [];
    const muscles = [...new Set(workouts[selectedWorkout].exercises.map(ex => ex.muscle))];
    return muscles;
  };

  const downloadExcel = () => {
    if (!selectedWorkout) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Esercizio,Serie,Peso,Ripetizioni,Completato\n";
    
    workouts[selectedWorkout].exercises.forEach((exercise, idx) => {
      const data = workoutData[idx];
      if (data) {
        for (let i = 0; i < exercise.sets; i++) {
          const completed = i < data.completedSets ? "Sì" : "No";
          const weight = data.weights[i] || "";
          const reps = data.reps[i] || "";
          csvContent += `"${exercise.name}",${i + 1},"${weight}","${reps}","${completed}"\n`;
        }
      }
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `allenamento_${selectedWorkout}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    clearTimeout(timerRef.current);
  };

  const resetTimer = () => {
    setTimer(0);
    setIsTimerRunning(false);
    clearTimeout(timerRef.current);
  };

  if (!selectedWorkout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-100 mb-2 flex items-center justify-center gap-3">
              <Dumbbell className="text-emerald-500" />
              Gym Tracker Pro
            </h1>
            <p className="text-slate-400">Scegli il tuo allenamento per iniziare</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(workouts).map(([key, workout]) => (
              <div key={key} className="bg-slate-800/50 backdrop-blur-md rounded-xl p-6 border border-slate-700/50 hover:bg-slate-800/70 transition-all duration-300 cursor-pointer transform hover:scale-105" onClick={() => startWorkout(key)}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-white">{key}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-100 mb-2">Giorno {key}</h3>
                  <p className="text-slate-400 mb-4">{workout.name}</p>
                  <div className="text-sm text-slate-500">
                    {workout.exercises.length} esercizi
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentWorkout = workouts[selectedWorkout];
  const muscleGroups = getMuscleGroups();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-6 mb-6 border border-slate-700/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                <Target className="text-emerald-500" />
                Giorno {selectedWorkout} - {currentWorkout.name}
              </h1>
              <button 
                onClick={() => setSelectedWorkout(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors mt-2"
              >
                ← Cambia allenamento
              </button>
            </div>
            <div className="flex gap-4">
              <button
                onClick={downloadExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download size={20} />
                Scarica Excel
              </button>
            </div>
          </div>
        </div>

        {/* Timer */}
        {timer > 0 && (
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-xl p-4 mb-6 text-center">
            <div className="flex items-center justify-center gap-4">
              <Clock className="text-white" size={24} />
              <span className="text-2xl font-bold text-white">{formatTime(timer)}</span>
              <div className="flex gap-2">
                <button 
                  onClick={stopTimer} 
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded transition-colors"
                >
                  <Pause size={16} />
                </button>
                <button 
                  onClick={resetTimer} 
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded transition-colors"
                >
                  <RotateCcw size={16} />
                </button>
                <button 
                  onClick={resetTimer} 
                  className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-1 rounded transition-colors font-medium"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Muscle Groups Progress */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-6 mb-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Progressi per Gruppo Muscolare</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {muscleGroups.map(muscle => {
              const progress = getCompletedSetsForMuscle(muscle);
              const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
              
              return (
                <div key={muscle} className="text-center">
                  <div className="text-slate-100 font-medium mb-2">{muscle}</div>
                  <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-slate-400">{progress.completed}/{progress.total}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Exercises */}
        <div className="space-y-4">
          {currentWorkout.exercises.map((exercise, exerciseIdx) => {
            const exerciseData = workoutData[exerciseIdx] || { completedSets: 0, weights: Array(exercise.sets).fill(''), reps: Array(exercise.sets).fill('') };
            
            return (
              <div key={exerciseIdx} className="bg-slate-800/50 backdrop-blur-md rounded-xl p-6 border border-slate-700/50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-100">{exercise.name}</h3>
                    <div className="flex gap-4 text-sm text-slate-400 mt-1">
                      <span>Serie: {exercise.sets}</span>
                      <span>Ripetizioni: {exercise.reps}</span>
                      <span>Riposo: {formatTime(exercise.rest)}</span>
                      <span className="text-emerald-400">Gruppo: {exercise.muscle}</span>
                    </div>
                  </div>
                  <div className="text-right mt-2 md:mt-0">
                    <div className="text-lg font-bold text-slate-100">
                      {exerciseData.completedSets}/{exercise.sets}
                    </div>
                    <div className="text-sm text-slate-400">serie completate</div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {Array.from({ length: exercise.sets }, (_, setIdx) => {
                    const isCompleted = setIdx < exerciseData.completedSets;
                    
                    return (
                      <div key={setIdx} className={`p-4 rounded-lg border-2 transition-all ${
                        isCompleted ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-700/30 border-slate-600/50'
                      }`}>
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                          <div className="flex items-center gap-2 min-w-20">
                            <span className="text-slate-100 font-medium">Serie {setIdx + 1}</span>
                            {isCompleted && <Check className="text-emerald-400" size={20} />}
                          </div>
                          
                          <div className="flex flex-col md:flex-row gap-4 flex-1">
                            <div className="flex flex-col">
                              <label className="text-sm text-slate-400 mb-1">Peso (kg)</label>
                              <input
                                type="number"
                                step="0.5"
                                value={exerciseData.weights[setIdx]}
                                onChange={(e) => {
                                  const newData = { ...workoutData };
                                  if (!newData[exerciseIdx]) {
                                    newData[exerciseIdx] = { completedSets: 0, weights: Array(exercise.sets).fill(''), reps: Array(exercise.sets).fill('') };
                                  }
                                  newData[exerciseIdx].weights[setIdx] = e.target.value;
                                  setWorkoutData(newData);
                                }}
                                className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 w-24 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                placeholder="0"
                              />
                            </div>
                            
                            <div className="flex flex-col">
                              <label className="text-sm text-slate-400 mb-1">Ripetizioni</label>
                              <input
                                type="number"
                                value={exerciseData.reps[setIdx]}
                                onChange={(e) => {
                                  const newData = { ...workoutData };
                                  if (!newData[exerciseIdx]) {
                                    newData[exerciseIdx] = { completedSets: 0, weights: Array(exercise.sets).fill(''), reps: Array(exercise.sets).fill('') };
                                  }
                                  newData[exerciseIdx].reps[setIdx] = e.target.value;
                                  setWorkoutData(newData);
                                }}
                                className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 w-24 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                placeholder="0"
                              />
                            </div>
                            
                            <button
                              onClick={() => completeSet(exerciseIdx, setIdx, exerciseData.weights[setIdx], exerciseData.reps[setIdx])}
                              disabled={isCompleted || !exerciseData.weights[setIdx] || !exerciseData.reps[setIdx]}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                isCompleted 
                                  ? 'bg-emerald-600/80 text-white cursor-default' 
                                  : exerciseData.weights[setIdx] && exerciseData.reps[setIdx]
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {isCompleted ? 'Completata' : 'Completa Serie'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GymTracker;
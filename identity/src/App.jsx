import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  Trophy, 
  GraduationCap, 
  Lightbulb, 
  Bug, 
  Shuffle, 
  Check,
  X,
  ArrowRight,
  Loader2
} from 'lucide-react';

export default function QuizApp() {
  const [questions, setQuestions] = useState([]);
  const [originalQuestions, setOriginalQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [randomQuestions, setRandomQuestions] = useState(false);
  const [randomAnswers, setRandomAnswers] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [gotoValue, setGotoValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    if (originalQuestions.length > 0) {
      initQuiz();
    }
  }, [randomQuestions, randomAnswers, originalQuestions]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch('./questions.json', { cache: 'no-store' });
      
      if (!response.ok) {
        throw new Error(`Errore nel caricamento: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('questions.json deve contenere un array di domande');
      }
      
      if (data.length === 0) {
        throw new Error('Nessuna domanda trovata in questions.json');
      }
      
      setOriginalQuestions(data);
      setError(null);
    } catch (err) {
      console.error('Errore caricamento domande:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const randomizeAnswers = (question) => {
    const indices = question.originalOptions.map((_, idx) => idx);
    const shuffled = shuffleArray(indices);
    
    return {
      ...question,
      options: shuffled.map(i => question.originalOptions[i]),
      correct: question.originalCorrect.map(c => shuffled.indexOf(c))
    };
  };

  const initQuiz = () => {
    let processedQuestions = originalQuestions.map(q => ({
      ...q,
      options: [...q.options],
      correct: [...q.correct],
      originalOptions: [...q.options],
      originalCorrect: [...q.correct]
    }));

    if (randomQuestions) {
      processedQuestions = shuffleArray(processedQuestions);
    }

    if (randomAnswers) {
      processedQuestions = processedQuestions.map(randomizeAnswers);
    }

    setQuestions(processedQuestions);
    setUserAnswers(new Array(processedQuestions.length).fill(null).map(() => []));
    setCurrentIndex(0);
    setShowResults(false);
    setShowExplanation(false);
    setStartTime(Date.now());
  };

  const handleAnswerChange = (optionIndex, isChecked) => {
    const question = questions[currentIndex];
    const isMultiple = question.correct.length > 1;
    const newAnswers = [...userAnswers];

    if (isMultiple) {
      if (isChecked) {
        if (!newAnswers[currentIndex].includes(optionIndex)) {
          newAnswers[currentIndex] = [...newAnswers[currentIndex], optionIndex];
        }
      } else {
        newAnswers[currentIndex] = newAnswers[currentIndex].filter(a => a !== optionIndex);
      }
    } else {
      newAnswers[currentIndex] = isChecked ? [optionIndex] : [];
    }

    setUserAnswers(newAnswers);
    setShowExplanation(false);
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      const userAnswer = [...(userAnswers[i] || [])].sort();
      const correctAnswer = [...q.correct].sort();
      if (JSON.stringify(userAnswer) === JSON.stringify(correctAnswer)) {
        correct++;
      }
    });
    return {
      correct,
      total: questions.length,
      percentage: Math.round((correct / questions.length) * 100)
    };
  };

  const goToQuestion = () => {
    const num = parseInt(gotoValue);
    if (!isNaN(num) && num >= 1 && num <= questions.length) {
      setCurrentIndex(num - 1);
      setShowExplanation(false);
      setGotoValue('');
    }
  };

  const handleFinish = () => {
    setShowResults(true);
  };

  const getOptionVariant = (optionIndex) => {
    const question = questions[currentIndex];
    const isSelected = userAnswers[currentIndex]?.includes(optionIndex);
    const isCorrect = question.correct.includes(optionIndex);

    if (showExplanation) {
      if (isCorrect) return 'correct';
      if (isSelected && !isCorrect) return 'incorrect';
    } else if (isSelected) {
      return 'selected';
    }
    return 'default';
  };

  const reportIssue = () => {
    const q = questions[currentIndex];
    const pageUrl = window.location.href;
    const title = encodeURIComponent(`Domanda errata #${currentIndex + 1} (ID ${q.id ?? 'n/a'})`);
    const body = encodeURIComponent(
`**Pagina:** ${pageUrl}

**Domanda #:** ${currentIndex + 1}
**ID:** ${q.id ?? 'n/a'}

---

### Testo domanda
${q.text}

---

### Opzioni
${q.options.map((o, i) => `- ${i + 1}) ${o}`).join('\n')}

---

### Risposta/e attesa/e (indici)
${(q.correct ?? []).join(', ')}

---

### Descrizione del problema
- 

### Proposta di correzione
- 
`
    );
    
    const GITHUB_REPO = 'antoninofugazzotto/web_app';
    const TEMPLATE = 'segnalazione-domanda-errata.yml';
    const url = `https://github.com/${GITHUB_REPO}/issues/new?template=${TEMPLATE}&title=${title}&body=${body}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-2xl border-slate-700">
          <CardHeader className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-500" />
            <CardTitle className="text-2xl">Caricamento domande...</CardTitle>
            <CardDescription>Attendere prego</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-2xl border-red-900 bg-red-50">
          <CardHeader className="text-center space-y-4">
            <X className="w-12 h-12 mx-auto text-red-600" />
            <CardTitle className="text-2xl text-red-900">Errore nel caricamento</CardTitle>
            <CardDescription className="text-red-700">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadQuestions} className="w-full bg-red-600 hover:bg-red-700">
              Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  const question = questions[currentIndex];
  const isMultiple = question.correct.length > 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const score = calculateScore();

  if (showResults) {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl shadow-2xl border-slate-700 bg-slate-50">
          <CardHeader className="text-center space-y-4 pb-8">
            <div className="flex justify-center">
              <Trophy className="w-20 h-20 text-yellow-500 animate-bounce" />
            </div>
            <CardTitle className="text-4xl font-bold text-slate-900">Quiz Completato!</CardTitle>
            <div className={`text-7xl font-black ${score.percentage >= 80 ? 'text-green-600' : score.percentage >= 60 ? 'text-orange-500' : 'text-red-600'}`}>
              {score.percentage}%
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="border-l-4 border-l-blue-600 bg-white">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-600">Punteggio</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{score.correct}/{score.total}</div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-slate-600 bg-white">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-600">Tempo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-700">{minutes}m {seconds}s</div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-600 bg-white">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-600">Corrette</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{score.correct}</div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-600 bg-white">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-600">Sbagliate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{score.total - score.correct}</div>
                </CardContent>
              </Card>
            </div>
            <Button onClick={initQuiz} size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
              <Shuffle className="mr-2 h-5 w-5" />
              Ricomincia Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Card */}
        <Card className="shadow-2xl border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-3xl font-bold flex items-center gap-3">
                <GraduationCap className="w-8 h-8 text-blue-400" />
                Quiz di Esame
              </CardTitle>
            </div>
            
            <Progress value={progress} className="h-3 bg-slate-700" />
            
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center p-3 bg-blue-600/20 border border-blue-500/30 rounded-lg backdrop-blur">
                <div className="text-2xl font-bold text-blue-400">{currentIndex + 1}</div>
                <div className="text-sm text-slate-300">Domanda</div>
              </div>
              <div className="text-center p-3 bg-slate-700/50 border border-slate-600 rounded-lg backdrop-blur">
                <div className="text-2xl font-bold text-slate-300">{questions.length}</div>
                <div className="text-sm text-slate-400">Totale</div>
              </div>
              <div className="text-center p-3 bg-green-600/20 border border-green-500/30 rounded-lg backdrop-blur">
                <div className="text-2xl font-bold text-green-400">{score.correct}</div>
                <div className="text-sm text-slate-300">Corrette</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Question Card */}
        <Card className="shadow-2xl border-slate-700 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Badge className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700">
                Domanda {currentIndex + 1}
              </Badge>
              <Badge variant="outline" className="text-sm px-4 py-2 border-slate-300">
                {isMultiple ? 'Risposta Multipla' : 'Risposta Singola'}
              </Badge>
            </div>
            <CardTitle className="text-xl md:text-2xl pt-4 leading-relaxed text-slate-900">
              {question.text}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {question.options.map((option, index) => {
              const variant = getOptionVariant(index);
              const isSelected = userAnswers[currentIndex]?.includes(index);
              const inputType = isMultiple ? 'checkbox' : 'radio';
              
              return (
                <label
                  key={index}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                    variant === 'selected' ? 'border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]' :
                    variant === 'correct' ? 'border-green-500 bg-green-50' :
                    variant === 'incorrect' ? 'border-red-500 bg-red-50' :
                    'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type={inputType}
                    checked={isSelected}
                    onChange={(e) => handleAnswerChange(index, e.target.checked)}
                    className="w-5 h-5 accent-blue-600"
                  />
                  <span className="flex-1 text-base md:text-lg text-slate-800">{option}</span>
                  {variant === 'correct' && <Check className="w-5 h-5 text-green-600" />}
                  {variant === 'incorrect' && <X className="w-5 h-5 text-red-600" />}
                </label>
              );
            })}

            <div className="flex gap-3 pt-4 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setShowExplanation(!showExplanation)}
                className="border-slate-300 hover:bg-slate-50"
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                Mostra risposta
              </Button>
              <Button
                variant="outline"
                onClick={reportIssue}
                className="border-slate-300 hover:bg-slate-50"
              >
                <Bug className="mr-2 h-4 w-4" />
                Segnala errore
              </Button>
            </div>

            {showExplanation && question.explanation && (
              <Alert className="mt-4 border-blue-200 bg-blue-50">
                <Lightbulb className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  {question.explanation}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex justify-between border-t border-slate-200 pt-6">
            <Button
              variant="outline"
              onClick={() => {
                setCurrentIndex(Math.max(0, currentIndex - 1));
                setShowExplanation(false);
              }}
              disabled={currentIndex === 0}
              className="border-slate-300"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Precedente
            </Button>
            
            <Button
              onClick={() => {
                if (currentIndex === questions.length - 1) {
                  handleFinish();
                } else {
                  setCurrentIndex(currentIndex + 1);
                  setShowExplanation(false);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {currentIndex === questions.length - 1 ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Termina
                </>
              ) : (
                <>
                  Prossima
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Controls Card */}
        <Card className="shadow-xl border-slate-700 bg-slate-50">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3 items-center justify-center">
              <Input
                type="number"
                placeholder="N. domanda"
                value={gotoValue}
                onChange={(e) => setGotoValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && goToQuestion()}
                className="w-32 border-slate-300"
                min="1"
                max={questions.length}
              />
              <Button variant="outline" onClick={goToQuestion} className="border-slate-300">
                <ArrowRight className="mr-2 h-4 w-4" />
                Vai
              </Button>
              
              <Button
                variant={randomQuestions ? "default" : "outline"}
                onClick={() => setRandomQuestions(!randomQuestions)}
                className={randomQuestions ? "bg-blue-600 hover:bg-blue-700" : "border-slate-300"}
              >
                <Shuffle className="mr-2 h-4 w-4" />
                Domande Random
              </Button>
              
              <Button
                variant={randomAnswers ? "default" : "outline"}
                onClick={() => setRandomAnswers(!randomAnswers)}
                className={randomAnswers ? "bg-blue-600 hover:bg-blue-700" : "border-slate-300"}
              >
                <Shuffle className="mr-2 h-4 w-4" />
                Risposte Random
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
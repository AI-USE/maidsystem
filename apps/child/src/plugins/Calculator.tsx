import React, { useState } from 'react';
import { Calculator } from 'lucide-react';

const CalculatorApp: React.FC = () => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');

  const handleNumber = (n: string) => {
    setDisplay(prev => prev === '0' ? n : prev + n);
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const calculate = () => {
    try {
      const parts = equation.trim().split(' ');
      if (parts.length < 2) return;

      const num1 = parseFloat(parts[0]);
      const operator = parts[1];
      const num2 = parseFloat(display);

      let result = 0;
      switch (operator) {
          case '+': result = num1 + num2; break;
          case '-': result = num1 - num2; break;
          case '*': result = num1 * num2; break;
          case '/': result = num2 !== 0 ? num1 / num2 : NaN; break;
          default: result = num2;
      }

      setDisplay(String(Number.isFinite(result) ? result : 'Error'));
      setEquation('');
    } catch (e) {
      setDisplay('Error');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
  };

  return (
    <div className="flex flex-col h-full bg-black/20 p-8 items-center justify-center">
      <div className="w-full max-w-xs glass-panel p-6 bg-white/5 border-white/10">
        <div className="text-right mb-4">
          <div className="text-[10px] text-white/40 h-4 uppercase tracking-widest">{equation}</div>
          <div className="text-3xl font-light tracking-tighter text-white truncate">{display}</div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {['7', '8', '9', '/'].map(btn => (
            <button key={btn} onClick={() => btn === '/' ? handleOperator('/') : handleNumber(btn)} className="calc-btn">{btn}</button>
          ))}
          {['4', '5', '6', '*'].map(btn => (
            <button key={btn} onClick={() => btn === '*' ? handleOperator('*') : handleNumber(btn)} className="calc-btn">{btn}</button>
          ))}
          {['1', '2', '3', '-'].map(btn => (
            <button key={btn} onClick={() => btn === '-' ? handleOperator('-') : handleNumber(btn)} className="calc-btn">{btn}</button>
          ))}
          {['C', '0', '=', '+'].map(btn => (
            <button key={btn} onClick={() => {
                if (btn === 'C') clear();
                else if (btn === '=') calculate();
                else if (btn === '+') handleOperator('+');
                else handleNumber('0');
            }} className={`calc-btn ${btn === '=' ? 'bg-white text-black' : ''}`}>{btn}</button>
          ))}
        </div>
      </div>
      <style>{`
        .calc-btn {
          @apply p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium uppercase tracking-widest;
        }
      `}</style>
    </div>
  );
};

export const CalculatorPlugin = {
  id: 'calculator',
  title: 'CALC_UNIT',
  icon: <Calculator size={18} />,
  component: CalculatorApp,
};

import React, { useState, useEffect } from 'react';
import { Calculator, Zap, AlertCircle, Activity } from 'lucide-react';

export default function App() {
  // 選擇系統型態狀態 (單相/三相)
  const [systemType, setSystemType] = useState('three-phase'); // 'single-phase' or 'three-phase'

  // State for Voltage inputs (A, B, C phases)
  const [voltages, setVoltages] = useState({
    a: '',
    b: '',
    c: ''
  });

  // State for Primary Current inputs (A, B, C phases)
  const [primaryCurrents, setPrimaryCurrents] = useState({
    a: '',
    b: '',
    c: ''
  });

  // State for Current inputs (A, B, C phases)
  const [currents, setCurrents] = useState({
    a: '',
    b: '',
    c: ''
  });

  // 狀態：用來追蹤最後被修改的是哪個電流欄位，以避免無限迴圈
  // 'primary', 'secondary', 或 null
  const [lastModifiedSource, setLastModifiedSource] = useState({
    a: null,
    b: null,
    c: null
  });

  // State for calculated results
  const [results, setResults] = useState({
    avgVoltage: 0,
    avgPrimaryCurrent: 0,
    avgCurrent: 0,
    currentTimesMultiplier: {
      a: null,
      b: null,
      c: null
    } as { [key: string]: number | null },
    instantaneousPower: 0, // 這是 KVA1
    usedMultiplier: 1,
    usedFactor: Math.sqrt(3),
    item102TimesMultiplier: null as number | null,
    differenceRatio: null as number | null 
  });

  // State for validation errors
  const [error, setError] = useState('');

  // State for Multiplier
  const [multiplier, setMultiplier] = useState('40');

  // State for 102 Item
  const [item102, setItem102] = useState('');

  // Handle input changes for voltages
  const handleVoltageChange = (phase: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setVoltages(prev => ({ ...prev, [phase]: value }));
      setError('');
    }
  };

  // Handle input changes for primary currents
  const handlePrimaryCurrentChange = (phase: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPrimaryCurrents(prev => ({ ...prev, [phase]: value }));
      setLastModifiedSource(prev => ({ ...prev, [phase]: 'primary' }));
      
      // 立即連動計算二次電流，避免 useEffect 延遲感
      const mult = parseFloat(multiplier);
      if (!isNaN(mult) && mult !== 0) {
        if (value === '') {
           setCurrents(prev => ({ ...prev, [phase]: '' }));
        } else {
           const pri = parseFloat(value);
           if (!isNaN(pri)) {
             const secVal = (pri / mult).toFixed(4).replace(/\.?0+$/, '');
             setCurrents(prev => ({ ...prev, [phase]: secVal }));
           }
        }
      }
      setError('');
    }
  };

  // Handle input changes for currents (secondary)
  const handleCurrentChange = (phase: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setCurrents(prev => ({ ...prev, [phase]: value }));
      setLastModifiedSource(prev => ({ ...prev, [phase]: 'secondary' }));
      
      // 立即連動計算一次電流
      const mult = parseFloat(multiplier);
      if (!isNaN(mult) && mult !== 0) {
        if (value === '') {
           setPrimaryCurrents(prev => ({ ...prev, [phase]: '' }));
        } else {
           const sec = parseFloat(value);
           if (!isNaN(sec)) {
             const priVal = (sec * mult).toFixed(4).replace(/\.?0+$/, '');
             setPrimaryCurrents(prev => ({ ...prev, [phase]: priVal }));
           }
        }
      }
      setError('');
    }
  };

  // Handle input changes for multiplier
  const handleMultiplierChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setMultiplier(value);
      setError('');
    }
  };

  // Handle input changes for 102 Item
  const handleItem102Change = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setItem102(value);
      setError('');
    }
  };

  // 當倍數改變時，重新計算關聯值 (基於最後修改的來源)
  useEffect(() => {
    const mult = parseFloat(multiplier);
    if (isNaN(mult) || mult === 0) return;

    // 我們需要同時更新 primary 和 secondary，所以使用函數式的 setState 避免依賴過期狀態
    let nextPrimary = { ...primaryCurrents };
    let nextSecondary = { ...currents };
    let hasChanges = false;

    (['a', 'b', 'c'] as const).forEach(phase => {
      const source = lastModifiedSource[phase as keyof typeof lastModifiedSource];
      
      if (source === 'primary') {
        const pri = parseFloat(primaryCurrents[phase as keyof typeof primaryCurrents]);
        if (!isNaN(pri)) {
          const newSec = (pri / mult).toFixed(4).replace(/\.?0+$/, '');
          if (nextSecondary[phase as keyof typeof nextSecondary] !== newSec) {
            nextSecondary[phase as keyof typeof nextSecondary] = newSec;
            hasChanges = true;
          }
        }
      } else if (source === 'secondary') {
        const sec = parseFloat(currents[phase as keyof typeof currents]);
        if (!isNaN(sec)) {
          const newPri = (sec * mult).toFixed(4).replace(/\.?0+$/, '');
          if (nextPrimary[phase as keyof typeof nextPrimary] !== newPri) {
            nextPrimary[phase as keyof typeof nextPrimary] = newPri;
            hasChanges = true;
          }
        }
      }
    });

    if (hasChanges) {
      setPrimaryCurrents(nextPrimary);
      setCurrents(nextSecondary);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplier]); // 只在倍數改變時觸發重新校準

  // Calculate whenever inputs change, including systemType
  useEffect(() => {
    calculatePower();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voltages, primaryCurrents, currents, multiplier, systemType, item102]);


  const calculatePower = () => {
    // Parse inputs to floats, return null if empty or invalid to distinguish from actual 0
    const parseInput = (val: string) => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    };

    const va = parseInput(voltages.a);
    const vb = parseInput(voltages.b);
    const vc = parseInput(voltages.c);

    const ipa = parseInput(primaryCurrents.a);
    const ipb = parseInput(primaryCurrents.b);
    const ipc = parseInput(primaryCurrents.c);

    const ia = parseInput(currents.a);
    const ib = parseInput(currents.b);
    const ic = parseInput(currents.c);

    // Parse multiplier, default to 1 if empty or invalid
    const mult = parseInput(multiplier) || 1;
    
    // Parse 102 Item
    const parsedItem102 = parseInput(item102);

    // Calculate individual current * multiplier
    const currentMultA = ia !== null ? ia * mult : null;
    const currentMultB = ib !== null ? ib * mult : null;
    const currentMultC = ic !== null ? ic * mult : null;
    
    // Calculate 102 Item * multiplier
    const item102Mult = parsedItem102 !== null ? parsedItem102 * mult : null;

    // Calculate average voltage based on valid inputs
    let validVoltageCount = 0;
    let sumVoltage = 0;
    
    if (va !== null) { sumVoltage += va; validVoltageCount++; }
    if (systemType !== 'single-phase') {
      if (vb !== null) { sumVoltage += vb; validVoltageCount++; }
      if (vc !== null) { sumVoltage += vc; validVoltageCount++; }
    }

    const avgV = validVoltageCount > 0 ? sumVoltage / validVoltageCount : 0;

    // Calculate average primary current based on valid inputs
    let validPrimaryCurrentCount = 0;
    let sumPrimaryCurrent = 0;

    if (ipa !== null) { sumPrimaryCurrent += ipa; validPrimaryCurrentCount++; }
    if (ipb !== null) { sumPrimaryCurrent += ipb; validPrimaryCurrentCount++; }
    if (systemType !== 'single-phase') {
      if (ipc !== null) { sumPrimaryCurrent += ipc; validPrimaryCurrentCount++; }
    }

    const avgPrimaryI = validPrimaryCurrentCount > 0 ? sumPrimaryCurrent / validPrimaryCurrentCount : 0;

    // Calculate average current based on valid inputs
    let validCurrentCount = 0;
    let sumCurrent = 0;

    if (ia !== null) { sumCurrent += ia; validCurrentCount++; }
    if (ib !== null) { sumCurrent += ib; validCurrentCount++; }
    if (systemType !== 'single-phase') {
      if (ic !== null) { sumCurrent += ic; validCurrentCount++; }
    }

    const avgI = validCurrentCount > 0 ? sumCurrent / validCurrentCount : 0;

    // Calculate Instantaneous Power:
    // 三相：√3 * V_avg * I_avg * 倍數 / 1000 (kW)
    // 單相：V_avg * I_avg * 倍數 / 1000 (kW)
    const factor = systemType === 'three-phase' ? Math.sqrt(3) : 1;
    const powerKw = (factor * avgV * avgI * mult) / 1000; // KVA1

    // Calculate Ratio: (KVA2 - KVA1) / KVA2
    let ratio = null;
    if (item102Mult !== null && item102Mult !== 0) {
      ratio = ((item102Mult - powerKw) / item102Mult) * 100; // 轉換為百分比
    }

    setResults({
      avgVoltage: avgV,
      avgPrimaryCurrent: avgPrimaryI,
      avgCurrent: avgI,
      currentTimesMultiplier: {
        a: currentMultA,
        b: currentMultB,
        c: currentMultC
      },
      instantaneousPower: powerKw,
      usedMultiplier: mult,
      usedFactor: factor, // 儲存使用的係數以供顯示
      item102TimesMultiplier: item102Mult, // 儲存 102項 乘 倍數 結果
      differenceRatio: ratio // 儲存比例計算結果
    });
  };

  const clearInputs = () => {
    setVoltages({ a: '', b: '', c: '' });
    setPrimaryCurrents({ a: '', b: '', c: '' });
    setCurrents({ a: '', b: '', c: '' });
    setLastModifiedSource({ a: null, b: null, c: null }); // 重置修改來源標記
    setMultiplier('40');
    setItem102('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-blue-600 p-6 text-white text-center">
          <div className="flex justify-center mb-2">
            <Zap className="w-8 h-8 text-yellow-300" />
          </div>
          <h1 className="text-2xl font-bold tracking-wider">倍數測定計算機</h1>
        </div>

        <div className="p-6 space-y-6">
          
          {/* 系統型態選擇 */}
          <div className="flex justify-center mb-2">
            <div className="bg-gray-100 p-1 rounded-lg flex inline-flex shadow-inner">
              <button
                onClick={() => setSystemType('single-phase')}
                className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
                  systemType === 'single-phase'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                單相 (不乘√3)
              </button>
              <button
                onClick={() => setSystemType('three-phase')}
                className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
                  systemType === 'three-phase'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                三相 (乘√3)
              </button>
            </div>
          </div>

          {/* Instruction or Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Voltage Inputs */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
              <span className="w-2 h-6 bg-blue-500 rounded-full inline-block"></span>
              輸入線電壓 (V)
            </h2>
            <div className={`grid ${systemType === 'single-phase' ? 'grid-cols-1 max-w-[120px] mx-auto' : 'grid-cols-3'} gap-3`}>
              {(['a', 'b', 'c'] as const)
                .filter((phase) => systemType !== 'single-phase' || phase === 'a')
                .map((phase) => (
                  <div key={`v-${phase}`} className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase flex justify-center">
                      {systemType === 'single-phase' && phase === 'a' ? 'ab' : phase} 相
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={voltages[phase]}
                      onChange={(e) => handleVoltageChange(phase, e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                    />
                  </div>
                ))}
            </div>
          </div>

          {/* Primary Current Inputs */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
              <span className="w-2 h-6 bg-teal-500 rounded-full inline-block"></span>
              輸入一次線電流 (A)
            </h2>
            <div className={`grid ${systemType === 'single-phase' ? 'grid-cols-2 max-w-[240px] mx-auto' : 'grid-cols-3'} gap-3`}>
              {(['a', 'b', 'c'] as const)
                .filter((phase) => systemType !== 'single-phase' || phase !== 'c')
                .map((phase) => (
                  <div key={`pi-${phase}`} className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase flex justify-center">{phase} 相</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={primaryCurrents[phase]}
                      onChange={(e) => handlePrimaryCurrentChange(phase, e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors shadow-sm"
                    />
                  </div>
                ))}
            </div>
          </div>

          {/* Current Inputs */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
              <span className="w-2 h-6 bg-green-500 rounded-full inline-block"></span>
              輸入二次線電流 (A)
            </h2>
            <div className={`grid ${systemType === 'single-phase' ? 'grid-cols-2 max-w-[240px] mx-auto' : 'grid-cols-3'} gap-3`}>
              {(['a', 'b', 'c'] as const)
                .filter((phase) => systemType !== 'single-phase' || phase !== 'c')
                .map((phase) => (
                  <div key={`i-${phase}`} className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase flex justify-center">{phase} 相</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currents[phase]}
                      onChange={(e) => handleCurrentChange(phase, e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors shadow-sm"
                    />
                  </div>
                ))}
            </div>
          </div>

          {/* Multiplier Input */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
              <span className="w-2 h-6 bg-purple-500 rounded-full inline-block"></span>
              輸入倍數
            </h2>
            <div className="space-y-1">
              <input
                type="text"
                inputMode="decimal"
                value={multiplier}
                onChange={(e) => handleMultiplierChange(e.target.value)}
                placeholder="40"
                className="w-full px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors shadow-sm"
              />
            </div>
          </div>

          {/* 102 Item Input */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
              <span className="w-2 h-6 bg-orange-500 rounded-full inline-block"></span>
              輸入 [102項]
            </h2>
            <div className="space-y-1">
              <input
                type="text"
                inputMode="decimal"
                value={item102}
                onChange={(e) => handleItem102Change(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors shadow-sm"
              />
            </div>
          </div>

          {/* Results Section */}
          <div className="mt-8 bg-gray-50 rounded-xl p-5 border border-gray-200">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 text-center">計算結果</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <span className="text-gray-600 font-medium">平均電壓</span>
                <span className="text-lg font-semibold text-gray-800">{results.avgVoltage.toFixed(2)} <span className="text-sm text-gray-500">V</span></span>
              </div>
              
              <div className="flex justify-between items-center px-2">
                <span className="text-gray-600 font-medium">一次平均電流</span>
                <span className="text-lg font-semibold text-gray-800">{results.avgPrimaryCurrent.toFixed(2)} <span className="text-sm text-gray-500">A</span></span>
              </div>
              
              <div className="flex justify-between items-center px-2">
                <span className="text-gray-600 font-medium">二次平均電流</span>
                <span className="text-lg font-semibold text-gray-800">{results.avgCurrent.toFixed(2)} <span className="text-sm text-gray-500">A</span></span>
              </div>

              {/* 移除各相電流 x 倍數 顯示區塊 */}

              <div className="pt-4 border-t border-gray-200">
                <div className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg border border-blue-100 shadow-sm">
                  <span className="text-sm font-medium text-blue-800 mb-1">KVA1-瞬時功率(P)</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-blue-600">{results.instantaneousPower.toFixed(3)}</span>
                    <span className="text-xl font-bold text-blue-800">kW</span>
                  </div>
                  <div className="mt-2 text-xs text-blue-500/70 font-mono text-center">
                    {systemType === 'three-phase' ? '√3 × ' : ''}{results.avgVoltage.toFixed(1)}V × {results.avgCurrent.toFixed(1)}A × {results.usedMultiplier} / 1000
                  </div>
                </div>
              </div>

              {/* 102項 x 倍數 顯示區塊 */}
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 space-y-2 mt-4">
                <div className="flex items-center gap-2 text-orange-700 font-medium border-b border-orange-200 pb-2 mb-2">
                  <Activity className="w-4 h-4" />
                  <span>KVA2: [102項] × 倍數 ({results.usedMultiplier})</span>
                </div>
                
                <div className="text-center bg-white rounded p-3 shadow-sm border border-orange-50">
                  <div className="text-2xl font-bold text-orange-800">
                    {results.item102TimesMultiplier !== null 
                      ? results.item102TimesMultiplier.toFixed(3) 
                      : '-'}
                  </div>
                </div>
              </div>

              {/* 誤差結果計算區塊 */}
              <div className="bg-red-50 p-3 rounded-lg border border-red-100 space-y-2 mt-4">
                <div className="flex items-center gap-2 text-red-700 font-medium border-b border-red-200 pb-2 mb-2">
                  <Activity className="w-4 h-4" />
                  <span>誤差結果: (KVA2 - KVA1) / KVA2</span>
                </div>
                
                <div className="text-center bg-white rounded p-3 shadow-sm border border-red-50">
                  <div className={`text-2xl font-bold ${results.differenceRatio !== null && Math.abs(results.differenceRatio) > 5 ? 'text-red-600' : 'text-gray-800'}`}>
                    {results.differenceRatio !== null 
                      ? `${results.differenceRatio.toFixed(2)} %` 
                      : '-'}
                  </div>
                  {results.differenceRatio !== null && (
                    <div className="mt-1 text-xs text-red-500/70 font-mono text-center">
                      ({results.item102TimesMultiplier?.toFixed(3)} - {results.instantaneousPower.toFixed(3)}) / {results.item102TimesMultiplier?.toFixed(3)}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Actions */}
          <div className="pt-4">
            <button
              onClick={clearInputs}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Calculator className="w-4 h-4" />
              清除重置
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';

export default function ABTestingCalculator() {
  const [controlVisitors, setControlVisitors] = useState(0);
  const [controlConversions, setControlConversions] = useState(0);
  const [variantVisitors, setVariantVisitors] = useState(0);
  const [variantConversions, setVariantConversions] = useState(0);
  const [results, setResults] = useState(null);

  const calculateSignificance = () => {
    // Validation
    if (controlVisitors <= 0 || variantVisitors <= 0) {
      setResults({ error: "Visitors must be greater than zero" });
      return;
    }
    
    if (controlConversions > controlVisitors || variantConversions > variantVisitors) {
      setResults({ error: "Conversions cannot exceed visitors" });
      return;
    }
    
    // Calculate conversion rates
    const controlRate = controlConversions / controlVisitors;
    const variantRate = variantConversions / variantVisitors;
    const improvement = ((variantRate - controlRate) / controlRate) * 100;
    
    // Calculate standard error
    const controlStdError = Math.sqrt((controlRate * (1 - controlRate)) / controlVisitors);
    const variantStdError = Math.sqrt((variantRate * (1 - variantRate)) / variantVisitors);
    
    // Calculate z-score
    const zScore = (variantRate - controlRate) / Math.sqrt(Math.pow(controlStdError, 2) + Math.pow(variantStdError, 2));
    
    // Calculate p-value using approximation
    const p = normalCDF(Math.abs(zScore));
    const confidence = (1 - ((1 - p) * 2)) * 100;
    
    setResults({
      controlRate: (controlRate * 100).toFixed(2) + "%",
      variantRate: (variantRate * 100).toFixed(2) + "%",
      improvement: improvement.toFixed(2) + "%",
      confidence: confidence.toFixed(2) + "%",
      significant: confidence >= 95,
      zScore: zScore.toFixed(2)
    });
  };
  
  // Normal cumulative distribution function approximation
  const normalCDF = (z) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z > 0) prob = 1 - prob;
    return prob;
  };
  
  const handleInputChange = (setter) => (e) => {
    const value = parseInt(e.target.value) || 0;
    setter(value >= 0 ? value : 0);
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold text-gray-800 mb-4">A/B Testing Significance Calculator</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-md">
          <h3 className="font-semibold text-blue-800 mb-2">Control (A)</h3>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Visitors</label>
            <input
              type="number"
              value={controlVisitors}
              onChange={handleInputChange(setControlVisitors)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conversions</label>
            <input
              type="number"
              value={controlConversions}
              onChange={handleInputChange(setControlConversions)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="0"
            />
          </div>
        </div>
        
        <div className="p-4 bg-green-50 rounded-md">
          <h3 className="font-semibold text-green-800 mb-2">Variant (B)</h3>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Visitors</label>
            <input
              type="number"
              value={variantVisitors}
              onChange={handleInputChange(setVariantVisitors)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conversions</label>
            <input
              type="number"
              value={variantConversions}
              onChange={handleInputChange(setVariantConversions)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="0"
            />
          </div>
        </div>
      </div>
      
      <button
        onClick={calculateSignificance}
        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition"
      >
        Calculate Significance
      </button>
      
      {results && (
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h3 className="font-semibold text-gray-800 mb-2">Results</h3>
          
          {results.error ? (
            <div className="text-red-600">{results.error}</div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm text-gray-600">Control Rate:</div>
                <div className="text-sm font-medium">{results.controlRate}</div>
                
                <div className="text-sm text-gray-600">Variant Rate:</div>
                <div className="text-sm font-medium">{results.variantRate}</div>
                
                <div className="text-sm text-gray-600">Improvement:</div>
                <div className="text-sm font-medium">{results.improvement}</div>
                
                <div className="text-sm text-gray-600">Confidence:</div>
                <div className="text-sm font-medium">{results.confidence}</div>
              </div>
              
              <div className="pt-2 border-t border-gray-200">
                <div className={`p-2 rounded ${results.significant ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {results.significant 
                    ? '✓ Result is statistically significant (95%+ confidence)' 
                    : '⚠ Result is not statistically significant yet'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
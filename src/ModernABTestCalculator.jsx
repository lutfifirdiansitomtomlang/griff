import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer
} from 'recharts';

export default function ModernABTestCalculator() {
  const [formData, setFormData] = useState({
    controlVisitors: '',
    controlConversions: '',
    variantVisitors: '',
    variantConversions: '',
  });
  
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  // Function to communicate height to parent WordPress page
  const communicateHeight = () => {
    if (window.parent) {
      window.parent.postMessage({
        type: 'resize',
        height: document.body.scrollHeight
      }, '*');
    }
  };

  // Set up height communication
  useEffect(() => {
    // Send height on initial load
    communicateHeight();
    
    // Send height when results change
    if (results) {
      setTimeout(communicateHeight, 100); // Small delay to ensure charts have rendered
    }
    
    // Set up window resize listener
    window.addEventListener('resize', communicateHeight);
    return () => window.removeEventListener('resize', communicateHeight);
  }, [results]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const calculateSignificance = () => {
    // Parse inputs and validate
    const control = {
      visitors: parseInt(formData.controlVisitors, 10),
      conversions: parseInt(formData.controlConversions, 10)
    };
    
    const variant = {
      visitors: parseInt(formData.variantVisitors, 10),
      conversions: parseInt(formData.variantConversions, 10)
    };

    // Validation
    if (isNaN(control.visitors) || isNaN(control.conversions) || 
        isNaN(variant.visitors) || isNaN(variant.conversions)) {
      setError('Please enter valid numbers for all fields');
      setResults(null);
      return;
    }
    
    if (control.visitors <= 0 || variant.visitors <= 0) {
      setError('Visitor counts must be positive numbers');
      setResults(null);
      return;
    }
    
    if (control.conversions < 0 || variant.conversions < 0) {
      setError('Conversion counts cannot be negative');
      setResults(null);
      return;
    }
    
    if (control.conversions > control.visitors || variant.conversions > variant.visitors) {
      setError('Conversions cannot exceed visitors');
      setResults(null);
      return;
    }

    // Calculate conversion rates
    const controlRate = control.conversions / control.visitors;
    const variantRate = variant.conversions / variant.visitors;
    const improvement = ((variantRate - controlRate) / controlRate) * 100;

    // Calculate pooled standard error
    const pooledConversionRate = (control.conversions + variant.conversions) / (control.visitors + variant.visitors);
    const standardError = Math.sqrt(
      pooledConversionRate * (1 - pooledConversionRate) * (1/control.visitors + 1/variant.visitors)
    );
    
    // Calculate z-score
    const zScore = (variantRate - controlRate) / standardError;
    
    // Calculate p-value using normal approximation
    const pValue = calculatePValue(zScore);
    
    // Calculate confidence interval
    const criticalValue = 1.96; // 95% confidence level
    const marginOfError = criticalValue * standardError;
    const ciLower = ((variantRate - controlRate) - marginOfError) * 100;
    const ciUpper = ((variantRate - controlRate) + marginOfError) * 100;

    // Calculate sample size power
    const sampleSizeFactor = Math.sqrt(control.visitors + variant.visitors);
    const power = Math.min(100, Math.max(0, (Math.abs(zScore) / 2) * sampleSizeFactor));

    // Generate some recommendation text
    let recommendation = '';
    if (pValue < 0.05) {
      if (improvement > 0) {
        recommendation = "The variant outperforms the control with statistical significance. We recommend implementing this change.";
      } else {
        recommendation = "The variant performs worse than the control with statistical significance. We recommend keeping the control version.";
      }
    } else {
      if (Math.abs(improvement) < 1) {
        recommendation = "The difference is minimal and not statistically significant. Consider running the test longer or testing a more substantial change.";
      } else if (power < 50) {
        recommendation = "The sample size may be too small to detect the observed difference. Consider running the test longer to collect more data.";
      } else {
        recommendation = "The results are not statistically significant. Consider refining your hypothesis or testing a different approach.";
      }
    }

    setResults({
      controlRate: controlRate * 100,
      variantRate: variantRate * 100,
      improvement,
      zScore,
      pValue,
      significant: pValue < 0.05,
      confidenceInterval: [ciLower, ciUpper],
      control,
      variant,
      power,
      recommendation
    });
    
    setError('');
  };

  // Calculate p-value from z-score
  const calculatePValue = (z) => {
    z = Math.abs(z);
    const b0 = 0.2316419;
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;
    
    if (z > 6) return 0;
    
    const t = 1 / (1 + b0 * z);
    const PDF = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    const CDF = 1 - PDF * (b1 * t + b2 * Math.pow(t, 2) + b3 * Math.pow(t, 3) + b4 * Math.pow(t, 4) + b5 * Math.pow(t, 5));
    
    return 2 * (1 - CDF);
  };

  // Prepare chart data
  const conversionRateData = results ? [
    { name: 'Control', rate: results.controlRate },
    { name: 'Variant', rate: results.variantRate }
  ] : [];

  const visitorsData = results ? [
    {
      name: 'Control',
      visitors: results.control.visitors,
      conversions: results.control.conversions,
      nonConversions: results.control.visitors - results.control.conversions
    },
    {
      name: 'Variant',
      visitors: results.variant.visitors,
      conversions: results.variant.conversions,
      nonConversions: results.variant.visitors - results.variant.conversions
    }
  ] : [];

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden max-w-4xl mx-auto font-sans">
      <div className="px-6 py-5 bg-white border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800">A/B Testing Statistical Significance Calculator</h1>
      </div>
      
      {/* Form Section */}
      <div className="p-6 space-y-6">
        {/* Control Group */}
        <div className="bg-blue-50 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white text-xl font-medium">
                A
              </span>
            </div>
            <div className="ml-3">
              <h2 className="text-xl font-semibold text-blue-600">Control</h2>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visitors</label>
              <div className="relative">
                <input
                  type="number"
                  name="controlVisitors"
                  value={formData.controlVisitors}
                  onChange={handleInputChange}
                  className="block w-full pl-3 pr-10 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 5000"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                  </svg>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conversions</label>
              <div className="relative">
                <input
                  type="number"
                  name="controlConversions"
                  value={formData.controlConversions}
                  onChange={handleInputChange}
                  className="block w-full pl-3 pr-10 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Variant Group */}
        <div className="bg-green-50 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-green-600 text-white text-xl font-medium">
                B
              </span>
            </div>
            <div className="ml-3">
              <h2 className="text-xl font-semibold text-green-600">Variant</h2>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visitors</label>
              <div className="relative">
                <input
                  type="number"
                  name="variantVisitors"
                  value={formData.variantVisitors}
                  onChange={handleInputChange}
                  className="block w-full pl-3 pr-10 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., 5000"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                  </svg>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conversions</label>
              <div className="relative">
                <input
                  type="number"
                  name="variantConversions"
                  value={formData.variantConversions}
                  onChange={handleInputChange}
                  className="block w-full pl-3 pr-10 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., 550"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Calculate Button */}
        <button
          onClick={calculateSignificance}
          className="w-full bg-blue-600 text-white py-4 px-4 rounded-md font-semibold text-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Calculate Statistical Significance
        </button>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Results Section */}
      {results && (
        <>
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-5">
            <h2 className="text-xl font-bold text-gray-800">Test Results</h2>
          </div>
          
          <div className="p-6 space-y-8">
            {/* Conversion Rate Comparison */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-700">Conversion Rate Comparison</h3>
              </div>
              <div className="p-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={conversionRateData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis 
                        label={{ value: '%', angle: -90, position: 'insideLeft' }} 
                        tickFormatter={(value) => `${value}`}
                        domain={[0, 'auto']}
                      />
                      <Tooltip formatter={(value) => [`${value.toFixed(2)}%`, 'Conversion Rate']} />
                      <Legend />
                      <Bar dataKey="rate" name="Conversion Rate (%)" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-md p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Control Rate</p>
                    <p className="text-2xl font-bold text-blue-700">{results.controlRate.toFixed(2)}%</p>
                  </div>
                  <div className="bg-green-50 rounded-md p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Variant Rate</p>
                    <p className="text-2xl font-bold text-green-700">{results.variantRate.toFixed(2)}%</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Visitors and Conversions */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-700">Visitors and Conversions</h3>
              </div>
              <div className="p-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visitorsData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="conversions" stackId="stack" name="Conversions" fill="#10B981" />
                      <Bar dataKey="nonConversions" stackId="stack" name="Non-Conversions" fill="#E5E7EB" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-4 px-4 py-3 bg-gray-50 rounded-md text-sm">
                  <p className="font-medium">Sample Size:</p>
                  <p>Control: {results.control.visitors.toLocaleString()} visitors ({results.control.conversions.toLocaleString()} conversions)</p>
                  <p>Variant: {results.variant.visitors.toLocaleString()} visitors ({results.variant.conversions.toLocaleString()} conversions)</p>
                </div>
              </div>
            </div>
            
            {/* Statistical Analysis */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-700">Statistical Analysis</h3>
              </div>
              <div className="p-4">
                {/* Significance Indicator */}
                <div className={`p-4 rounded-md mb-6 flex items-center justify-center ${results.significant ? 'bg-green-100' : 'bg-red-100'}`}>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {results.significant ? (
                        <svg className="h-6 w-6 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-6 w-6 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className={`font-bold text-lg ${results.significant ? 'text-green-800' : 'text-red-800'}`}>
                        {results.significant ? 'Statistically Significant' : 'Not Statistically Significant'}
                      </span>
                    </div>
                    <p className={`text-sm ${results.significant ? 'text-green-600' : 'text-red-600'}`}>
                      {results.significant 
                        ? "We're 95% confident that the observed difference is real." 
                        : "We cannot be 95% confident that the observed difference is real."}
                    </p>
                  </div>
                </div>
                
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm text-gray-500 mb-1">Relative Improvement</p>
                    <p className={`text-xl font-bold ${results.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {results.improvement >= 0 ? '+' : ''}{results.improvement.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm text-gray-500 mb-1">p-value</p>
                    <p className="text-xl font-bold">
                      {results.pValue < 0.0001 ? '< 0.0001' : results.pValue.toFixed(4)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {results.pValue < 0.05 ? 'Significant (p < 0.05)' : 'Not Significant'}
                    </p>
                  </div>
                </div>
                
                {/* Confidence Interval */}
                <div className="bg-gray-50 rounded-md p-4 mb-6">
                  <h4 className="font-medium text-gray-700 mb-2">95% Confidence Interval</h4>
                  <p className="text-sm text-gray-600 mb-1">
                    95% Confidence Interval for Improvement:
                  </p>
                  <p className="font-bold mb-2">
                    {results.confidenceInterval[0].toFixed(2)}% to {results.confidenceInterval[1].toFixed(2)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    {results.confidenceInterval[0] * results.confidenceInterval[1] > 0 
                      ? `The entire confidence interval is ${results.confidenceInterval[0] > 0 ? 'positive' : 'negative'}, supporting a real effect.` 
                      : 'The confidence interval includes zero, suggesting the possibility of no real effect.'}
                  </p>
                </div>
                
                {/* Additional Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-md border border-gray-200 text-center">
                    <p className="text-xs text-gray-500 mb-1">Z-Score</p>
                    <p className="font-bold">{results.zScore.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">
                      {Math.abs(results.zScore) > 1.96 ? 'Significant' : 'Not Significant'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-md border border-gray-200 text-center">
                    <p className="text-xs text-gray-500 mb-1">Statistical Power</p>
                    <p className="font-bold">{results.power.toFixed(0)}%</p>
                    <p className="text-xs text-gray-400">
                      {results.power >= 80 ? 'Good power level' : 'Insufficient power'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-md border border-gray-200 text-center">
                    <p className="text-xs text-gray-500 mb-1">Absolute Difference</p>
                    <p className="font-bold">{(results.variantRate - results.controlRate).toFixed(2)}%</p>
                    <p className="text-xs text-gray-400">Raw percentage point difference</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Recommendations */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-700">Recommendations</h3>
              </div>
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100">
                      <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-gray-800 mb-3">{results.recommendation}</p>
                    
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Next Steps:</h5>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                      {results.significant ? (
                        results.improvement > 0 ? (
                          <>
                            <li>Implement the variant as the new control</li>
                            <li>Document learnings from this successful test</li>
                            <li>Consider additional optimizations</li>
                          </>
                        ) : (
                          <>
                            <li>Keep the original control version</li>
                            <li>Document what didn't work in this variant</li>
                            <li>Develop a new hypothesis for your next test</li>
                          </>
                        )
                      ) : (
                        <>
                          <li>Consider extending the test to gather more data</li>
                          <li>Test a more substantial change if the effect size is small</li>
                          <li>Re-evaluate your testing hypothesis</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
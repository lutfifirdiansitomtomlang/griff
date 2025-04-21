import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer
} from 'recharts';

export default function ABTestCalculator() {
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

  const confidenceData = results ? [
    { name: 'Lower Bound', value: results.confidenceInterval[0] },
    { name: 'Improvement', value: results.improvement - results.confidenceInterval[0] },
    { name: 'Upper Bound', value: results.confidenceInterval[1] - results.improvement }
  ] : [];

  return (
    <div className="bg-white p-4 rounded-lg shadow-md max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">A/B Test Calculator</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-md shadow">
          <h3 className="text-lg font-semibold mb-3 text-blue-700 flex items-center">
            <span className="bg-blue-700 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-sm">A</span>
            Control
          </h3>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Visitors</label>
            <input
              type="number"
              name="controlVisitors"
              value={formData.controlVisitors}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
              placeholder="e.g., 5000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conversions</label>
            <input
              type="number"
              name="controlConversions"
              value={formData.controlConversions}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
              placeholder="e.g., 500"
            />
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-md shadow">
          <h3 className="text-lg font-semibold mb-3 text-green-700 flex items-center">
            <span className="bg-green-700 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-sm">B</span>
            Variant
          </h3>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Visitors</label>
            <input
              type="number"
              name="variantVisitors"
              value={formData.variantVisitors}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition duration-200"
              placeholder="e.g., 5000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conversions</label>
            <input
              type="number"
              name="variantConversions"
              value={formData.variantConversions}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition duration-200"
              placeholder="e.g., 550"
            />
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <button
          onClick={calculateSignificance}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-200 shadow-md"
        >
          Calculate Significance
        </button>
      </div>
      
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 shadow">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {results && (
        <div className="bg-gray-50 p-4 rounded-md shadow">
          <h3 className="text-xl font-semibold mb-4 text-center border-b pb-2">Test Results</h3>
          
          {/* Primary Metrics */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded shadow-sm">
              <p className="text-sm text-gray-600">Control Rate</p>
              <p className="font-bold text-xl text-blue-800">{results.controlRate.toFixed(2)}%</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded shadow-sm">
              <p className="text-sm text-gray-600">Variant Rate</p>
              <p className="font-bold text-xl text-green-800">{results.variantRate.toFixed(2)}%</p>
            </div>
          </div>
          
          {/* Statistical Significance Indicator */}
          <div className="p-4 rounded-md mb-6" 
            style={{ 
              backgroundColor: results.significant ? '#dcfce7' : '#fee2e2',
              color: results.significant ? '#166534' : '#991b1b'
            }}>
            <div className="flex items-center justify-center text-lg font-bold mb-2">
              {results.significant ? (
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {results.significant 
                ? 'Statistically Significant' 
                : 'Not Statistically Significant'}
            </div>
            <p className="text-center text-sm">
              {results.significant 
                ? `We're 95% confident that the observed difference is real.` 
                : `We cannot be 95% confident that the observed difference is real.`}
            </p>
          </div>
          
          {/* Conversion Rate Comparison Chart */}
          <div className="bg-white p-3 rounded-md shadow mb-6">
            <h4 className="text-md font-semibold mb-3 text-gray-700">Conversion Rate Comparison</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={conversionRateData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                <Legend />
                <Bar dataKey="rate" name="Conversion Rate (%)" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Visitors and Conversions Chart */}
          <div className="bg-white p-3 rounded-md shadow mb-6">
            <h4 className="text-md font-semibold mb-3 text-gray-700">Visitors and Conversions</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={visitorsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="conversions" name="Conversions" fill="#10B981" />
                <Bar dataKey="nonConversions" name="Non-Conversions" fill="#E5E7EB" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
              <p>Control: {results.control.visitors} visitors ({results.control.conversions} conversions)</p>
              <p>Variant: {results.variant.visitors} visitors ({results.variant.conversions} conversions)</p>
            </div>
          </div>
          
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-3 bg-gray-50 rounded shadow-sm">
              <p className="text-sm text-gray-600">Relative Improvement</p>
              <p className={`font-bold ${results.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {results.improvement >= 0 ? '+' : ''}{results.improvement.toFixed(2)}%
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded shadow-sm">
              <p className="text-sm text-gray-600">p-value</p>
              <p className="font-bold">{results.pValue.toFixed(4)}</p>
              <p className="text-xs text-gray-500">{results.pValue < 0.05 ? 'Significant' : 'Not Significant'}</p>
            </div>
          </div>
          
          {/* Confidence Interval */}
          <div className="bg-white p-3 rounded-md shadow mb-6">
            <h4 className="text-md font-semibold mb-3 text-gray-700">95% Confidence Interval</h4>
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">Improvement Range (95% Confidence)</p>
              <p className="font-bold">
                {results.confidenceInterval[0].toFixed(2)}% to {results.confidenceInterval[1].toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {results.confidenceInterval[0] * results.confidenceInterval[1] > 0 
                  ? `The entire confidence interval is ${results.confidenceInterval[0] > 0 ? 'positive' : 'negative'}, supporting a real effect.` 
                  : 'The confidence interval includes zero, suggesting the possibility of no real effect.'}
              </p>
            </div>
          </div>
          
          {/* Recommendations Section */}
          <div className="bg-white p-4 rounded-md shadow mb-4">
            <h4 className="text-md font-semibold mb-3 text-indigo-700">Recommendations</h4>
            <div className="flex items-start">
              <div className="bg-indigo-100 p-1 rounded-full mr-3 mt-1">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-gray-700 text-sm mb-2">{results.recommendation}</p>
                <div className="mt-2">
                  <p className="text-xs font-semibold mb-1">Next Steps:</p>
                  <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
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
          
          {/* Additional Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2 rounded-md shadow">
              <h4 className="text-xs font-medium text-gray-600 mb-1">Z-Score</h4>
              <p className="font-bold text-sm">{results.zScore.toFixed(2)}</p>
            </div>
            <div className="bg-white p-2 rounded-md shadow">
              <h4 className="text-xs font-medium text-gray-600 mb-1">Power</h4>
              <p className="font-bold text-sm">{results.power.toFixed(0)}%</p>
            </div>
            <div className="bg-white p-2 rounded-md shadow">
              <h4 className="text-xs font-medium text-gray-600 mb-1">Absolute Diff</h4>
              <p className="font-bold text-sm">{(results.variantRate - results.controlRate).toFixed(2)}%</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="mt-4 text-center text-xs text-gray-500">
        A/B Test Statistical Significance Calculator
      </div>
    </div>
  );
}
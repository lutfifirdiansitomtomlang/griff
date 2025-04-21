import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
    ResponsiveContainer, ReferenceLine, BarChart, Bar, Label  } from "recharts";

export default function PriceOptimizationCalculator() {
  const [pricePoints, setPricePoints] = useState([
    { id: 1, price: 100, quantity: 500 },
    { id: 2, price: 120, quantity: 450 },
    { id: 3, price: 80, quantity: 600 },
  ]);
  const [nextId, setNextId] = useState(4);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  // Communicate height changes to parent container (for WordPress embedding)
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === containerRef.current) {
          // Send message to parent with height
          if (window.parent) {
            window.parent.postMessage({ 
              type: 'resize', 
              height: entry.contentRect.height 
            }, '*');
          }
        }
      }
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  const addPricePoint = () => {
    setPricePoints([...pricePoints, { id: nextId, price: "", quantity: "" }]);
    setNextId(nextId + 1);
  };

  const removePricePoint = (id) => {
    if (pricePoints.length > 2) {
      setPricePoints(pricePoints.filter(point => point.id !== id));
    }
  };

  const handleInputChange = (id, field, value) => {
    setPricePoints(pricePoints.map(point => 
      point.id === id ? { ...point, [field]: parseFloat(value) || "" } : point
    ));
    
    // Reset results when inputs change
    if (showResults) {
      setShowResults(false);
      setStatus({ type: "", message: "" });
    }
  };

  const calculateElasticity = () => {
    setLoading(true);
    setStatus({ type: "", message: "" });
    
    // Simulate a brief calculation time
    setTimeout(() => {
      try {
        // Validate data
        const validPoints = pricePoints.filter(
          point => !isNaN(point.price) && !isNaN(point.quantity) && point.price > 0 && point.quantity > 0
        );

        if (validPoints.length < 2) {
          setStatus({ 
            type: "error", 
            message: "Please enter at least two valid price points with quantity data."
          });
          setLoading(false);
          return;
        }

        // Sort by price
        const sortedPoints = [...validPoints].sort((a, b) => a.price - b.price);
        
        // Calculate elasticity between each pair of adjacent points
        const elasticityData = [];
        const revenueData = [];
        
        for (let i = 0; i < sortedPoints.length; i++) {
          const point = sortedPoints[i];
          const revenue = point.price * point.quantity;
          revenueData.push({
            price: point.price,
            revenue: revenue,
          });
          
          if (i > 0) {
            const prevPoint = sortedPoints[i - 1];
            const percentPriceChange = (point.price - prevPoint.price) / prevPoint.price;
            const percentQuantityChange = (point.quantity - prevPoint.quantity) / prevPoint.quantity;
            const elasticity = percentQuantityChange / percentPriceChange;
            
            elasticityData.push({
              priceRange: `${prevPoint.price.toFixed(2)} - ${point.price.toFixed(2)}`,
              startPrice: prevPoint.price,
              endPrice: point.price,
              startQuantity: prevPoint.quantity,
              endQuantity: point.quantity,
              elasticity: elasticity,
              midPoint: (prevPoint.price + point.price) / 2,
            });
          }
        }

        // Calculate average elasticity
        const totalElasticity = elasticityData.reduce((sum, item) => sum + Math.abs(item.elasticity), 0);
        const averageElasticity = totalElasticity / elasticityData.length;
        
        // Find optimal price point for revenue
        revenueData.sort((a, b) => b.revenue - a.revenue);
        const optimalPricePoint = revenueData[0];
        
        // Generate elasticity curve data
        const minPrice = Math.min(...sortedPoints.map(p => p.price)) * 0.7;
        const maxPrice = Math.max(...sortedPoints.map(p => p.price)) * 1.3;
        
        // Generate curve data based on average elasticity using the highest quantity point as reference
        const referencePoint = sortedPoints.reduce((max, point) => 
          point.quantity > max.quantity ? point : max, sortedPoints[0]
        );
        
        const curveData = [];
        const step = (maxPrice - minPrice) / 50;
        
        for (let price = minPrice; price <= maxPrice; price += step) {
          // Using constant elasticity model: Q2 = Q1 * (P2/P1)^elasticity
          const predictedQuantity = referencePoint.quantity * 
            Math.pow(price / referencePoint.price, -averageElasticity);
          
          const revenue = price * predictedQuantity;
          
          curveData.push({
            price: price,
            quantity: predictedQuantity,
            revenue: revenue,
          });
        }
        
        // Find optimal price from curve
        const optimalFromCurve = [...curveData].sort((a, b) => b.revenue - a.revenue)[0];
        
        // Prepare elasticity interpretation
        let interpretation;
        if (Math.abs(averageElasticity) > 1) {
          interpretation = "Elastic demand - customers are very sensitive to price changes. Consider lowering prices to increase revenue.";
        } else if (Math.abs(averageElasticity) < 1) {
          interpretation = "Inelastic demand - customers are less sensitive to price changes. You may be able to increase prices without significantly affecting demand.";
        } else {
          interpretation = "Unit elastic demand - changes in price are proportionally offset by changes in quantity demanded.";
        }

        // Prepare revenue impact data
        const currentRevenue = validPoints.reduce((sum, point) => sum + (point.price * point.quantity), 0) / validPoints.length;
        const optimalRevenue = optimalFromCurve.price * optimalFromCurve.quantity;
        const revenueIncrease = ((optimalRevenue - currentRevenue) / currentRevenue) * 100;

        // Prepare price elasticity by segment data for bar chart
        const elasticityBarData = elasticityData.map(item => ({
          name: `$${item.startPrice.toFixed(0)}-$${item.endPrice.toFixed(0)}`,
          elasticity: Math.abs(item.elasticity)
        }));

        setResults({
          elasticityData,
          averageElasticity,
          interpretation,
          optimalPricePoint,
          optimalFromCurve,
          curveData,
          revenueData,
          elasticityBarData,
          revenueIncrease
        });
        
        setShowResults(true);
        setStatus({ type: "success", message: "Analysis completed successfully!" });
      } catch (error) {
        console.error("Calculation error:", error);
        setStatus({ 
          type: "error", 
          message: "An error occurred during calculation. Please check your input data." 
        });
      } finally {
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Price Optimization Calculator</h2>
        <p className="text-gray-600">Analyze price elasticity and find your optimal price point</p>
      </div>

      {/* Input Section */}
      <div className="mb-6 bg-blue-50 p-6 rounded-lg shadow">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold mr-3">
            1
          </div>
          <h3 className="font-semibold text-lg">Enter Price Points and Quantities</h3>
        </div>
        
        <p className="text-sm text-gray-600 mb-4 ml-11">
          Enter at least three price points and their corresponding unit sales to calculate elasticity.
        </p>
        
        <div className="grid grid-cols-12 gap-3 font-semibold text-gray-700 mb-2 ml-11">
          <div className="col-span-5">Price ($)</div>
          <div className="col-span-5">Quantity (units)</div>
          <div className="col-span-2"></div>
        </div>
        
        <div className="space-y-3 ml-11">
          {pricePoints.map((point) => (
            <div key={point.id} className="grid grid-cols-12 gap-3">
              <div className="col-span-5">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={point.price}
                  onChange={(e) => handleInputChange(point.id, "price", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  placeholder="Enter price"
                />
              </div>
              <div className="col-span-5">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={point.quantity}
                  onChange={(e) => handleInputChange(point.id, "quantity", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  placeholder="Enter quantity"
                />
              </div>
              <div className="col-span-2 flex justify-end items-center">
                <button
                  onClick={() => removePricePoint(point.id)}
                  disabled={pricePoints.length <= 2}
                  className={`p-2 rounded-full ${
                    pricePoints.length <= 2
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-red-100 text-red-600 hover:bg-red-200"
                  }`}
                  title={pricePoints.length <= 2 ? "Minimum 2 price points required" : "Remove price point"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex flex-wrap space-x-4 mt-6 ml-11">
          <button
            onClick={addPricePoint}
            className="px-4 py-2 bg-white text-green-700 border border-green-300 rounded-md hover:bg-green-50 transition flex items-center shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Price Point
          </button>
          
          <button
            onClick={calculateElasticity}
            disabled={loading}
            className={`px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-md flex items-center ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Calculating...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Calculate Optimization
              </>
            )}
          </button>
        </div>
        
        {status.message && (
          <div className={`ml-11 mt-4 p-3 rounded-md ${
            status.type === "error" ? "bg-red-50 text-red-700" : 
            status.type === "success" ? "bg-green-50 text-green-700" : ""
          }`}>
            {status.type === "error" && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {status.type === "success" && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {status.message}
          </div>
        )}
      </div>

      {/* Results Section */}
      {showResults && results && (
        <div className="bg-gray-50 p-6 rounded-lg shadow mb-6">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold mr-3">
              2
            </div>
            <h3 className="font-semibold text-lg">Price Optimization Results</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 ml-11">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <div className="flex items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h4 className="font-semibold text-gray-700">Price Elasticity Coefficient</h4>
              </div>
              <p className="text-3xl font-bold text-blue-700">
                {Math.abs(results.averageElasticity).toFixed(2)}
              </p>
              <div className="mt-2 p-3 bg-blue-50 rounded">
                <p className="text-sm">{results.interpretation}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-md">
              <div className="flex items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="font-semibold text-gray-700">Optimal Price Point</h4>
              </div>
              <p className="text-3xl font-bold text-green-700">
                ${results.optimalFromCurve.price.toFixed(2)}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-500">Est. Revenue</p>
                  <p className="text-sm font-semibold text-gray-700">
                    ${Math.round(results.optimalFromCurve.revenue).toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-500">Est. Quantity</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {Math.round(results.optimalFromCurve.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
              {results.revenueIncrease > 0 && (
                <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Potential {results.revenueIncrease.toFixed(1)}% revenue increase
                </div>
              )}
            </div>
          </div>
          
          <div className="mb-6 ml-11">
            <div className="flex items-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <h4 className="font-semibold text-gray-700">Price Elasticity by Segment</h4>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md overflow-hidden">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={results.elasticityBarData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: 'Elasticity', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                    />
                    <Tooltip formatter={(value) => [value.toFixed(2), "Elasticity"]} />
                    <Legend verticalAlign="top" height={36} />
                    <ReferenceLine y={1} stroke="#ff7300" strokeDasharray="3 3">
                      <Label value="Unit Elastic" position="right" />
                    </ReferenceLine>
                    <Bar 
                      dataKey="elasticity" 
                      fill="#8884d8" 
                      name="Price Elasticity"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 ml-11">
            <div>
              <div className="flex items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <h4 className="font-semibold text-gray-700">Demand Curve</h4>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md" style={{ height: "280px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={results.curveData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="price" 
                      label={{ value: 'Price ($)', position: 'bottom', offset: 0 }}
                    />
                    <YAxis
                      label={{ value: 'Quantity', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip formatter={(value, name) => {
                      if (name === "quantity") return [Math.round(value).toLocaleString(), "Quantity"];
                      return [value.toFixed(2), name];
                    }} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="quantity" 
                      stroke="#3b82f6" 
                      activeDot={{ r: 8 }} 
                      name="Demand Curve"
                    />
                    <ReferenceLine 
                      x={results.optimalFromCurve.price} 
                      stroke="green" 
                      strokeDasharray="3 3" 
                      label={{ value: 'Optimal', position: 'top', fontSize: 12 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div>
              <div className="flex items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <h4 className="font-semibold text-gray-700">Revenue Curve</h4>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md" style={{ height: "280px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={results.curveData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="price" 
                      label={{ value: 'Price ($)', position: 'bottom', offset: 0 }}
                    />
                    <YAxis
                      label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip formatter={(value, name) => {
                      if (name === "revenue") return ["$" + Math.round(value).toLocaleString(), "Revenue"];
                      return [value.toFixed(2), name];
                    }} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#10b981" 
                      activeDot={{ r: 8 }}
                      name="Revenue Curve" 
                    />
                    <ReferenceLine 
                      x={results.optimalFromCurve.price} 
                      stroke="green" 
                      strokeDasharray="3 3" 
                      label={{ value: 'Optimal', position: 'top', fontSize: 12 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="ml-11">
            <div className="flex items-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              <h4 className="font-semibold text-gray-700">Elasticity Details</h4>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price Range ($)
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Elasticity
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Classification
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Implication
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.elasticityData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                        {item.priceRange}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                        {Math.abs(item.elasticity).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {Math.abs(item.elasticity) > 1 ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Elastic</span>
                        ) : Math.abs(item.elasticity) < 1 ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Inelastic</span>
                        ) : (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">Unit Elastic</span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                        {Math.abs(item.elasticity) > 1 
                          ? "Price sensitive segment"
                          : Math.abs(item.elasticity) < 1
                            ? "Price insensitive segment"
                            : "Neutral segment"
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Guide Section */}
      <div className="bg-gray-50 p-6 rounded-lg shadow">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 rounded-full bg-gray-600 text-white flex items-center justify-center font-bold mr-3">
            ?
          </div>
          <h3 className="font-semibold text-lg">How to Use This Tool</h3>
        </div>
        
        <div className="ml-11 space-y-4">
          <div className="bg-white p-4 rounded-md shadow-sm">
            <h4 className="font-medium text-gray-800 mb-2">What is Price Elasticity?</h4>
            <p className="text-sm text-gray-600">
              Price elasticity measures how sensitive customer demand is to price changes. It helps 
              you understand how your sales volume will change when you adjust your prices.
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-md shadow-sm">
            <h4 className="font-medium text-gray-800 mb-2">Understanding the Results:</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
              <li><span className="font-medium">Elasticity Coefficient:</span> Values greater than 1 indicate elastic demand (price sensitive customers).</li>
              <li><span className="font-medium">Optimal Price:</span> The price point that maximizes your revenue based on the calculated elasticity.</li>
              <li><span className="font-medium">Demand Curve:</span> Shows how quantity changes in response to price changes.</li>
              <li><span className="font-medium">Revenue Curve:</span> Shows how total revenue changes across different price points.</li>
            </ul>
          </div>
          
          <div className="flex items-center mt-4 p-3 bg-blue-50 rounded-md text-sm text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>
              <span className="font-semibold">Privacy Note:</span> All calculations are performed in your browser - no data is sent to our servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
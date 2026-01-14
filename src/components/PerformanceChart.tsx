import React, { useEffect, useState, useMemo } from 'react';
import { bitable, type IRecord } from '@lark-base-open/js-sdk';
import { Spin, Alert } from 'antd';

interface PersonData {
  id: string;
  name: string;
  perf: number;
  department: string;
  generalDom: number;
}

interface DepartmentBand {
  name: string;
  startX: number;
  width: number;
  people: PersonData[];
}

interface PersonPosition extends PersonData {
  x: number;
  y: number;
}

const PerformanceChart: React.FC = () => {
  const [data, setData] = useState<PersonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(1000);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const table = await bitable.base.getTableByName('person-perf');

        if (!table) {
          throw new Error('Table "person-perf" not found');
        }

        const records = await table.getRecords({ pageSize: 5000 });
        
        const fieldMetaList = await table.getFieldMetaList();

        // Find field IDs by name
        const perfField = fieldMetaList.find(f => f.name === 'perf');
        const deptField = fieldMetaList.find(f => f.name === 'Department');
        const personField = fieldMetaList.find(f => f.name === 'Person');
        const generalDomField = fieldMetaList.find(f => f.name === 'general-dom');

        if (!perfField || !deptField || !personField || !generalDomField) {
          throw new Error('Required fields not found');
        }

        // Parse records into PersonData
        const parsedData: PersonData[] = records.records
          .map((record: IRecord) => {
            const perfValue = record.fields[perfField.id];
            const deptValue = record.fields[deptField.id];
            const personValue = record.fields[personField.id];
            const generalDomValue = record.fields[generalDomField.id];

            // Extract department name (handle array or single value)
            let deptName = 'Unknown';
            if (Array.isArray(deptValue) && deptValue.length > 0) {
              const item = deptValue[0] as any;
              deptName = item?.text || item?.name || 'Unknown';
            } else if (deptValue && typeof deptValue === 'object') {
              deptName = (deptValue as any).text || (deptValue as any).name || 'Unknown';
            }

            // Extract person name
            let personName = 'Unknown';
            if (Array.isArray(personValue) && personValue.length > 0) {
              const item = personValue[0] as any;
              personName = item?.name || item?.text || 'Unknown';
            } else if (personValue && typeof personValue === 'object') {
              personName = (personValue as any).name || (personValue as any).text || 'Unknown';
            }

            // Parse perf value (handle both string and number)
            let perf = 0;
            if (typeof perfValue === 'number') {
              perf = perfValue;
            } else if (typeof perfValue === 'string') {
              perf = parseFloat(perfValue) || 0;
            }

            // Parse general-dom value (handle both string and number)
            let generalDom = 0;
            if (typeof generalDomValue === 'number') {
              generalDom = generalDomValue;
            } else if (typeof generalDomValue === 'string') {
              generalDom = parseFloat(generalDomValue) || 0;
            }

            return {
              id: record.recordId,
              name: personName,
              perf,
              department: deptName,
              generalDom,
            };
          })
          .filter(p => p.perf > 0); // Filter out invalid data

        setData(parsedData);
      } catch (err) {
        console.error('❌ Failed to fetch data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle container resize for responsive width
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate color based on general-dom value (0 to 1)
  // Black (0) -> White (1)
  const calcColor = (generalDom: number): string => {
    const t = Math.max(0, Math.min(1, generalDom));
    // Grayscale: 0 = black (0,0,0), 1 = white (255,255,255)
    const value = Math.round(255 * t);
    return `rgb(${value}, ${value}, ${value})`;
  };

  // Light colors for department backgrounds (HSL format for easy control)
  const lightColors = [
    'hsl(0, 70%, 85%)',   // Pink
    'hsl(200, 70%, 85%)', // Blue
    'hsl(120, 70%, 85%)', // Green
    'hsl(30, 70%, 85%)',  // Orange
    'hsl(270, 70%, 85%)', // Purple
    'hsl(60, 70%, 85%)',  // Yellow
    'hsl(180, 70%, 85%)', // Cyan
    'hsl(300, 70%, 85%)', // Magenta
    'hsl(90, 70%, 85%)',  // Lime
    'hsl(20, 70%, 85%)',  // Peach
  ];

  // Hash function to map dept name to color index
  const getDeptColor = (deptName: string): string => {
    let hash = 0;
    for (let i = 0; i < deptName.length; i++) {
      const char = deptName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Use unsigned right shift to ensure positive number
    const index = (hash >>> 0) % lightColors.length;
    return lightColors[index];
  };

  // Calculate department bands and layout
  const calculateLayout = (): DepartmentBand[] => {
    if (data.length === 0) return [];

    // Group by department
    const deptMap = new Map<string, PersonData[]>();
    data.forEach(person => {
      const dept = person.department;
      if (!deptMap.has(dept)) {
        deptMap.set(dept, []);
      }
      deptMap.get(dept)!.push(person);
    });

    // Calculate average general-dom for each department and sort
    const deptWithAvg = Array.from(deptMap.entries()).map(([name, people]) => ({
      name,
      people,
      avgGeneralDom: people.reduce((sum, p) => sum + p.generalDom, 0) / people.length,
    }));
    
    // Sort departments by average general-dom (ascending)
    deptWithAvg.sort((a, b) => a.avgGeneralDom - b.avgGeneralDom);

    // Calculate available width for bands
    const padding = { left: 60, right: 50 };
    const availableWidth = containerWidth - padding.left - padding.right;
    
    // Calculate band widths proportional to member count
    const totalMembers = data.length;
    const bands: DepartmentBand[] = [];
    let currentX = 0;

    deptWithAvg.forEach(({ name, people }) => {
      // Band width is strictly proportional to member count
      const bandWidth = (people.length / totalMembers) * availableWidth;
      
      bands.push({
        name,
        startX: currentX,
        width: bandWidth,
        people,
      });
      currentX += bandWidth;
    });

    return bands;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert message={error} type="error" showIcon />;
  }

  if (data.length === 0) {
    return <Alert message="No data available" type="info" showIcon />;
  }

  return <ChartRenderer 
    data={data} 
    containerWidth={containerWidth}
    containerRef={containerRef}
    svgRef={svgRef}
    mousePos={mousePos}
    setMousePos={setMousePos}
    calculateLayout={calculateLayout}
    calcColor={calcColor}
    getDeptColor={getDeptColor}
  />;
};

// Separate component for rendering to avoid hooks being called after conditional returns
interface ChartRendererProps {
  data: PersonData[];
  containerWidth: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  mousePos: { x: number; y: number } | null;
  setMousePos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  calculateLayout: () => DepartmentBand[];
  calcColor: (generalDom: number) => string;
  getDeptColor: (deptName: string) => string;
}

const ChartRenderer: React.FC<ChartRendererProps> = ({
  data,
  containerWidth,
  containerRef,
  svgRef,
  mousePos,
  setMousePos,
  calculateLayout,
  calcColor,
  getDeptColor,
}) => {
  const bands = calculateLayout();
  const chartHeight = 900;
  const padding = { top: 40, right: 50, bottom: 80, left: 60 };
  const chartWidth = containerWidth;

  // Calculate Y-axis scale
  const maxPerf = Math.max(...data.map(p => p.perf));
  const minPerf = Math.min(...data.map(p => p.perf));
  const perfRange = maxPerf - minPerf;
  const yScale = (perf: number) => {
    return chartHeight - padding.bottom - ((perf - minPerf) / perfRange) * (chartHeight - padding.top - padding.bottom);
  };

  // Track all person positions for hit detection (memoized to prevent recalculation on mouse move)
  const personPositions: PersonPosition[] = useMemo(() => {
    const positions: PersonPosition[] = [];
    bands.forEach((band) => {
      const bandX = padding.left + band.startX;
      band.people.forEach((person) => {
        const randomOffset = Math.random() * (band.width - 20) + 10;
        const x = bandX + randomOffset;
        const y = yScale(person.perf);
        positions.push({ ...person, x, y });
      });
    });
    return positions;
  }, [data, containerWidth]); // Only recalculate when data or width changes

  // Get current department based on mouse X position
  const getCurrentDepartment = (mx: number): string | null => {
    const adjustedX = mx - padding.left;
    for (const band of bands) {
      if (adjustedX >= band.startX && adjustedX < band.startX + band.width) {
        return band.name;
      }
    }
    return null;
  };

  // Find nearest persons within 30px radius in current department only in current department only
  const getNearestPersons = (mx: number, my: number): PersonPosition[] => {
    const radius = 30;
    const currentDept = getCurrentDepartment(mx);
    
    return personPositions
      .filter(p => p.department === currentDept) // Only persons in current department
      .map(p => ({
        ...p,
        distance: Math.sqrt(Math.pow(p.x - mx, 2) + Math.pow(p.y - my, 2))
      }))
      .filter(p => p.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  const nearestPersons = mousePos ? getNearestPersons(mousePos.x, mousePos.y) : [];

  // Calculate average performance metrics (weighted average)
  const sumGeneralDomPerf = data.reduce((sum, p) => sum + p.generalDom * p.perf, 0);
  const sumGeneralDom = data.reduce((sum, p) => sum + p.generalDom, 0);
  const avgGeneralPerf = sumGeneralDom > 0 ? sumGeneralDomPerf / sumGeneralDom : 0;
  
  const sumProjectDomPerf = data.reduce((sum, p) => sum + (1 - p.generalDom) * p.perf, 0);
  const sumProjectDom = data.reduce((sum, p) => sum + (1 - p.generalDom), 0);
  const avgProjectPerf = sumProjectDom > 0 ? sumProjectDomPerf / sumProjectDom : 0;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'auto', userSelect: 'none' }}>
      {/* Header with average performance metrics */}
      <div style={{ 
        padding: '12px 20px', 
        background: '#f5f5f5', 
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        gap: '30px',
        fontSize: '14px',
        fontWeight: '500',
      }}>
        <div>
          AVG General Perf: <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{avgGeneralPerf.toFixed(2)}</span>
        </div>
        <div>
          AVG Project Perf: <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{avgProjectPerf.toFixed(2)}</span>
        </div>
      </div>
      <svg 
        ref={svgRef}
        width={chartWidth} 
        height={chartHeight} 
        style={{ border: '1px solid #e0e0e0', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={chartHeight - padding.bottom}
          stroke="#333"
          strokeWidth={2}
        />

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const value = minPerf + perfRange * ratio;
          const y = yScale(value);
          return (
            <g key={ratio}>
              <line
                x1={padding.left - 5}
                y1={y}
                x2={padding.left}
                y2={y}
                stroke="#333"
                strokeWidth={1}
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize={12}
                fill="#666"
              >
                {value.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text
          x={20}
          y={chartHeight / 2}
          textAnchor="middle"
          fontSize={14}
          fill="#333"
          transform={`rotate(-90, 20, ${chartHeight / 2})`}
        >
          Performance
        </text>

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          stroke="#333"
          strokeWidth={2}
        />

        {/* Department bands and labels */}
        {bands.map((band, idx) => {
          const x = padding.left + band.startX;
          const bandCenterX = x + band.width / 2;
          const bandColor = getDeptColor(band.name);

          return (
            <g key={idx}>
              {/* Band background */}
              <rect
                x={x}
                y={padding.top}
                width={band.width}
                height={chartHeight - padding.top - padding.bottom}
                fill={bandColor}
                opacity={0.3}
              />

              {/* Department label */}
              <text
                x={bandCenterX}
                y={chartHeight - padding.bottom + 20}
                textAnchor="start"
                fontSize={12}
                fill="#333"
                fontWeight="bold"
                transform={`rotate(45, ${bandCenterX}, ${chartHeight - padding.bottom + 20})`}
              >
                {band.name}
              </text>
            </g>
          );
        })}

        {/* Data points (dots and labels) */}
        {personPositions.map((person) => {
          const color = calcColor(person.generalDom);

          return (
            <g key={person.id}>
              {/* Dot */}
              <circle
                cx={person.x}
                cy={person.y}
                r={5}
                fill={color}
                stroke="#000"
                strokeWidth={1}
              />

              {/* Person name */}
              <text
                x={person.x}
                y={person.y - 10}
                textAnchor="middle"
                fontSize={10}
                fill="#000"
                fontWeight="500"
              >
                {person.name}
              </text>
            </g>
          );
        })}

        {/* Crosshair and tooltip */}
        {mousePos && (
          <g>
            {/* Vertical line */}
            <line
              x1={mousePos.x}
              y1={padding.top}
              x2={mousePos.x}
              y2={chartHeight - padding.bottom}
              stroke="#666"
              strokeWidth={1}
              strokeDasharray="4,4"
              pointerEvents="none"
            />
            {/* Horizontal line */}
            <line
              x1={padding.left}
              y1={mousePos.y}
              x2={chartWidth - padding.right}
              y2={mousePos.y}
              stroke="#666"
              strokeWidth={1}
              strokeDasharray="4,4"
              pointerEvents="none"
            />

            {/* Tooltip */}
            {nearestPersons.length > 0 && (
              <g>
                {/* Tooltip background */}
                <rect
                  x={mousePos.x + 10}
                  y={mousePos.y - 10}
                  width={180}
                  height={nearestPersons.length * 20 + 35}
                  fill="white"
                  stroke="#333"
                  strokeWidth={1}
                  rx={4}
                  pointerEvents="none"
                />
                {/* Department name header */}
                <text
                  x={mousePos.x + 15}
                  y={mousePos.y + 5}
                  fontSize={12}
                  fill="#333"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {nearestPersons[0].department}
                </text>
                {/* Separator line */}
                <line
                  x1={mousePos.x + 15}
                  y1={mousePos.y + 10}
                  x2={mousePos.x + 175}
                  y2={mousePos.y + 10}
                  stroke="#ddd"
                  strokeWidth={1}
                  pointerEvents="none"
                />
                {/* Tooltip text */}
                {nearestPersons.map((person, idx) => (
                  <text
                    key={person.id}
                    x={mousePos.x + 15}
                    y={mousePos.y + idx * 20 + 30}
                    fontSize={11}
                    fill="#333"
                    pointerEvents="none"
                  >
                    {person.name}: {person.perf.toFixed(2)}
                  </text>
                ))}
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};

export default PerformanceChart;

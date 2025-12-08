'use client'

import { memo, useMemo } from 'react'
import { XPGraph } from '@/components/ui/xp-components'
import { formatBytes, getPrintStateText, formatTime } from '@/lib/utils/taskmanager-utils'
import type { SystemStats, SystemInfo } from '@/app/api/printer/system-stats/route'

interface ApplicationsTabProps {
  printState: string
  filename: string
  printProgress: number
  currentLayer: number
  totalLayers: number
}

// Applications Tab - Shows running print jobs
export const ApplicationsTab = memo(function ApplicationsTab({
  printState,
  filename,
  printProgress,
  currentLayer,
  totalLayers
}: ApplicationsTabProps) {
  const statusText = getPrintStateText(printState)
  const isActive = printState === 'printing' || printState === 'paused' || printState === 'complete'
  
  return (
    <div className="p-1 h-full font-['Tahoma'] text-xs flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-2 bg-[#D4D0C8] border-b border-[#808080] text-black font-bold">
        <div className="px-2 py-1 border-r border-[#FFFFFF]">Task</div>
        <div className="px-2 py-1">Status</div>
      </div>
      
      {/* Task list */}
      <div className="flex-1 overflow-y-auto bg-white">
        {isActive ? (
          <div className={`grid grid-cols-2 text-black ${printState === 'printing' ? 'bg-[#316AC5] text-white' : 'bg-white'}`}>
            <div className="px-2 py-1 truncate flex items-center gap-2">
              <span>📄</span> {filename || 'Unknown Job'}
            </div>
            <div className="px-2 py-1">{statusText}</div>
          </div>
        ) : (
          <div className="text-black text-center py-8">
            No tasks running.
          </div>
        )}
      </div>
      
      {/* Status bar at bottom */}
      <div className="p-2 border-t border-[#919B9C] text-black text-[10px]">
        {printState === 'printing' || printState === 'paused' ? (
          <span>Progress: {printProgress.toFixed(0)}% • Layer: {currentLayer}/{totalLayers || '?'}</span>
        ) : (
          <span>Ready</span>
        )}
      </div>
    </div>
  )
})

interface ProcessesTabProps {
  systemStats: SystemStats | null
  systemInfo: SystemInfo | null
  extruderActual: number
  extruderPower: number
  bedActual: number
  bedPower: number
  printState: string
}

// Processes Tab - Shows printer components like Windows processes
export const ProcessesTab = memo(function ProcessesTab({
  systemStats,
  systemInfo,
  extruderActual,
  extruderPower,
  bedActual,
  bedPower,
  printState
}: ProcessesTabProps) {
  const stats = systemStats
  const serviceEntries = useMemo(() => 
    Object.entries(systemInfo?.services || {}),
    [systemInfo?.services]
  )
  
  return (
    <div className="p-1 h-full font-['Tahoma'] text-xs flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-4 bg-[#D4D0C8] border-b border-[#808080] text-black font-bold">
        <div className="px-2 py-1 border-r border-[#FFFFFF]">Image Name</div>
        <div className="px-2 py-1 border-r border-[#FFFFFF]">PID</div>
        <div className="px-2 py-1 border-r border-[#FFFFFF] text-right">CPU</div>
        <div className="px-2 py-1 text-right">Mem Usage</div>
      </div>
      
      {/* Process list */}
      <div className="flex-1 overflow-y-auto bg-white">
        {/* Klipper */}
        <div className="grid grid-cols-4 text-black bg-white hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">klippy.py</div>
          <div className="px-2 py-0.5">{stats?.system?.cpuUsage?.cores?.length || '1'}</div>
          <div className="px-2 py-0.5 text-right">{((stats?.system?.cpuUsage?.total || 0) * 0.6).toFixed(0)}%</div>
          <div className="px-2 py-0.5 text-right">{formatBytes((stats?.system?.memory?.used || 0) * 0.4)}</div>
        </div>
        
        {/* Moonraker */}
        <div className="grid grid-cols-4 text-black bg-[#F5F5F5] hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">moonraker.py</div>
          <div className="px-2 py-0.5">2</div>
          <div className="px-2 py-0.5 text-right">{((stats?.system?.cpuUsage?.total || 0) * 0.2).toFixed(0)}%</div>
          <div className="px-2 py-0.5 text-right">{formatBytes((stats?.system?.memory?.used || 0) * 0.2)}</div>
        </div>
        
        {/* Hotend Heater */}
        <div className="grid grid-cols-4 text-black bg-white hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">heater_extruder</div>
          <div className="px-2 py-0.5">3</div>
          <div className="px-2 py-0.5 text-right">{(extruderPower * 100).toFixed(0)}%</div>
          <div className="px-2 py-0.5 text-right">{extruderActual.toFixed(0)}°C</div>
        </div>
        
        {/* Bed Heater */}
        <div className="grid grid-cols-4 text-black bg-[#F5F5F5] hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">heater_bed</div>
          <div className="px-2 py-0.5">4</div>
          <div className="px-2 py-0.5 text-right">{(bedPower * 100).toFixed(0)}%</div>
          <div className="px-2 py-0.5 text-right">{bedActual.toFixed(0)}°C</div>
        </div>
        
        {/* Stepper Motors */}
        <div className="grid grid-cols-4 text-black bg-white hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">stepper_x</div>
          <div className="px-2 py-0.5">5</div>
          <div className="px-2 py-0.5 text-right">{printState === 'printing' ? '12%' : '0%'}</div>
          <div className="px-2 py-0.5 text-right">N/A</div>
        </div>
        
        <div className="grid grid-cols-4 text-black bg-[#F5F5F5] hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">stepper_y</div>
          <div className="px-2 py-0.5">6</div>
          <div className="px-2 py-0.5 text-right">{printState === 'printing' ? '12%' : '0%'}</div>
          <div className="px-2 py-0.5 text-right">N/A</div>
        </div>
        
        <div className="grid grid-cols-4 text-black bg-white hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">stepper_z</div>
          <div className="px-2 py-0.5">7</div>
          <div className="px-2 py-0.5 text-right">{printState === 'printing' ? '5%' : '0%'}</div>
          <div className="px-2 py-0.5 text-right">N/A</div>
        </div>
        
        {/* Part Fan */}
        <div className="grid grid-cols-4 text-black bg-[#F5F5F5] hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">fan</div>
          <div className="px-2 py-0.5">8</div>
          <div className="px-2 py-0.5 text-right">{printState === 'printing' ? '100%' : '0%'}</div>
          <div className="px-2 py-0.5 text-right">N/A</div>
        </div>

        {/* Services from system info */}
        {serviceEntries.map(([name, data], idx) => (
          <div 
            key={name}
            className={`grid grid-cols-4 text-black ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F5F5F5]'} hover:bg-[#316AC5] hover:text-white`}
          >
            <div className="px-2 py-0.5 truncate">{name}</div>
            <div className="px-2 py-0.5">{10 + idx}</div>
            <div className="px-2 py-0.5 text-right">{data.activeState === 'active' ? '1%' : '0%'}</div>
            <div className="px-2 py-0.5 text-right">{data.activeState}</div>
          </div>
        ))}
      </div>
      
      {/* Checkbox and button */}
      <div className="flex justify-between items-center p-2 border-t border-[#919B9C]">
        <label className="flex items-center gap-1 text-black">
          <input type="checkbox" defaultChecked className="w-3 h-3" />
          Show processes from all users
        </label>
        <button 
          className="px-4 py-1 text-xs border border-[#808080] bg-[#ECE9D8] hover:bg-[#F5F4EF] text-black"
          style={{ borderRadius: '2px' }}
        >
          End Process
        </button>
      </div>
    </div>
  )
})

interface NetworkingTabProps {
  systemStats: SystemStats | null
  networkHistory: Record<string, number[]>
}

// Networking Tab - Shows network interfaces
export const NetworkingTab = memo(function NetworkingTab({
  systemStats,
  networkHistory
}: NetworkingTabProps) {
  const networks = systemStats?.network || {}
  const networkEntries = useMemo(() => Object.entries(networks), [networks])

  return (
    <div className="p-3 h-full font-['Tahoma'] text-xs overflow-auto">
      <div className="grid grid-cols-1 gap-4">
        {networkEntries.length > 0 ? (
          networkEntries.map(([iface, data]) => (
            <div key={iface}>
              <XPGraph 
                data={networkHistory[iface] || new Array(60).fill(0)}
                maxValue={100}
                height={70}
                title={`${iface} - Network Utilization`}
              />
              <div className="mt-2 text-black">
                <div className="grid grid-cols-2 gap-x-4">
                  <span>Bytes Received:</span>
                  <span className="text-right">{formatBytes(data.rxBytes)}</span>
                  <span>Bytes Sent:</span>
                  <span className="text-right">{formatBytes(data.txBytes)}</span>
                  <span>Bandwidth:</span>
                  <span className="text-right">{data.bandwidth.toFixed(2)} bytes/s</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-black text-center py-8">
            No network interfaces available
          </div>
        )}
      </div>
    </div>
  )
})

interface UsersTabProps {
  websocketConnections: number
}

// Users Tab - Shows connected users
export const UsersTab = memo(function UsersTab({
  websocketConnections
}: UsersTabProps) {
  return (
    <div className="p-1 h-full font-['Tahoma'] text-xs flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-3 bg-[#D4D0C8] border-b border-[#808080] text-black font-bold">
        <div className="px-2 py-1 border-r border-[#FFFFFF]">User</div>
        <div className="px-2 py-1 border-r border-[#FFFFFF]">Session</div>
        <div className="px-2 py-1">Status</div>
      </div>
      
      {/* User list */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="grid grid-cols-3 text-black bg-white">
          <div className="px-2 py-0.5 truncate">pi</div>
          <div className="px-2 py-0.5">Console</div>
          <div className="px-2 py-0.5">Active</div>
        </div>
        {websocketConnections > 0 && (
          <div className="grid grid-cols-3 text-black bg-[#F5F5F5]">
            <div className="px-2 py-0.5 truncate">WebSocket ({websocketConnections})</div>
            <div className="px-2 py-0.5">Remote</div>
            <div className="px-2 py-0.5">Active</div>
          </div>
        )}
      </div>
    </div>
  )
})

import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "../../store/uiStore";

const commands = [
  ["Dashboard", "/dashboard"],
  ["Catalog", "/catalog"],
  ["New checkout", "/circulation"],
  ["Members", "/members"],
  ["Reservations", "/reservations"],
  ["Inventory", "/inventory"],
  ["Reports", "/reports"],
  ["Settings", "/settings"]
];

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useUiStore();
  const navigate = useNavigate();

  if (!paletteOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 grid place-items-start bg-[#122222]/60 dark:bg-black/75 pt-[18vh] backdrop-blur-sm transition-all"
      onMouseDown={() => setPaletteOpen(false)}
    >
      <Command 
        className="w-full max-w-xl overflow-hidden rounded-card bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/10 shadow-2xl flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Command.Input 
          autoFocus 
          placeholder="Search pages and actions..." 
          className="w-full border-b border-black/5 dark:border-white/5 p-4 outline-none text-[14px] text-[#122222] dark:text-white placeholder:text-[#122222]/40 dark:placeholder:white/40"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2 no-scrollbar">
          <Command.Empty className="p-4 text-sm text-[#122222]/60 dark:text-white/60">
            No matching command.
          </Command.Empty>
          {commands.map(([label, route]) => (
            <Command.Item 
              key={route} 
              value={label} 
              className="cursor-pointer rounded-control px-3.5 py-3 text-[13px] font-semibold text-[#122222] dark:text-white/80 transition-colors flex items-center justify-between data-[selected=true]:bg-[#1a4d40]/10 dark:data-[selected=true]:bg-[#1b9277]/10 data-[selected=true]:text-[#1a4d40] dark:data-[selected=true]:text-[#1b9277]"
              onSelect={() => { 
                navigate(route); 
                setPaletteOpen(false); 
              }}
            >
              <span>{label}</span>
              <span className="text-[10px] opacity-40 font-mono">Jump to</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}


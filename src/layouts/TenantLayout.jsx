import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
	Box,
	Button,
	List,
	ListItem,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Typography,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PaymentIcon from "@mui/icons-material/Payment";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

const NAV_ITEMS = [
	{ label: "Overview", path: "/tenant/dashboard", icon: <DashboardIcon /> },
	{ label: "Payments", path: "/tenant/payments", icon: <PaymentIcon /> },
	{ label: "Maintenance Report", path: "/tenant/maintenance", icon: <BuildOutlinedIcon /> },
];

export default function TenantLayout({ children }) {
	const navigate = useNavigate();
	const location = useLocation();

	const handleLogout = async () => {
		try {
			await signOut(auth);
			navigate("/login", { replace: true });
		} catch (error) {
			console.error("Failed to log out:", error);
		}
	};

	return (
		<Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#FAFAFA" }}>
			<Box
				component="aside"
				sx={{
					width: { xs: 190, sm: 240 },
					flexShrink: 0,
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					bgcolor: "#F5EFE6",
					borderRight: "1px solid #E5DFD5",
				}}
			>
				<Box>
					<Box sx={{ p: 3, pb: 2 }}>
						<Typography variant="h5" fontWeight="700" sx={{ color: "#FF6B35" }}>
							Tenant
						</Typography>
					</Box>
					<List sx={{ px: 0 }}>
						{NAV_ITEMS.map((item) => {
							const selected = location.pathname === item.path;
							return (
								<ListItem key={item.path} disablePadding>
									<ListItemButton
										selected={selected}
										onClick={() => navigate(item.path)}
										sx={{
											py: 1.5,
											px: 3,
											"&.Mui-selected": { bgcolor: "#FF6B35", color: "#FFFFFF" },
											"&.Mui-selected .MuiListItemIcon-root": { color: "#FFFFFF" },
										}}
									>
										<ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
										<ListItemText primary={item.label} />
									</ListItemButton>
								</ListItem>
							);
						})}
					</List>
				</Box>
				<Box sx={{ p: 2 }}>
					<Button
						onClick={handleLogout}
						startIcon={<LogoutIcon />}
						sx={{ color: "#FF6B35", justifyContent: "flex-start", width: "100%" }}
					>
						Logout
					</Button>
				</Box>
			</Box>
			<Box sx={{ minWidth: 0, flexGrow: 1, display: "flex", flexDirection: "column" }}>
				<Box
					component="header"
					sx={{ py: 2.5, px: { xs: 2, sm: 4 }, bgcolor: "#F5EFE6", borderBottom: "1px solid #E5DFD5" }}
				>
					<Typography variant="h6" fontWeight="600">
						{NAV_ITEMS.find((item) => location.pathname === item.path)?.label || "Tenant Portal"}
					</Typography>
				</Box>
				<Box component="main" sx={{ p: { xs: 2, sm: 4 }, flexGrow: 1, bgcolor: "#FFFFFF" }}>
					{children || <Outlet />}
				</Box>
			</Box>
		</Box>
	);
}

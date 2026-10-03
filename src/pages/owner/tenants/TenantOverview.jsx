import React, { useEffect, useState } from "react";
import {
	Alert,
	Box,
	Card,
	CardContent,
	Chip,
	CircularProgress,
		Button,
	Paper,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
} from "@mui/material";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PaymentIcon from "@mui/icons-material/Payment";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../../config/firebase";

const SUMMARY_ITEMS = [
	{ key: "propertyName", label: "Property", icon: <HomeWorkIcon />, fallback: "Not assigned" },
	{ key: "roomNumber", label: "Room", icon: <MeetingRoomIcon />, fallback: "Not assigned" },
	{ key: "monthlyRent", label: "Monthly Rent", icon: <PaymentIcon />, fallback: 0, currency: true },
];

const formatDate = (value) => {
	if (!value) return "—";
	const date = value?.toDate ? value.toDate() : new Date(value);
	return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

export default function TenantOverview({ section = "overview" }) {
	const navigate = useNavigate();
	const [tenantInfo, setTenantInfo] = useState({});
	const [tickets, setTickets] = useState([]);
	const [payments, setPayments] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		const user = auth.currentUser;
		if (!user) {
			navigate("/login", { replace: true });
			setLoading(false);
			return undefined;
		}

		let active = true;
		let unsubscribeTickets;
		let unsubscribePayments;

		const loadTenantProfile = async () => {
			try {
				const [userSnapshot, tenantSnapshot] = await Promise.all([
					getDoc(doc(db, "users", user.uid)),
					getDoc(doc(db, "tenants", user.uid)),
				]);
				const profile = {
					...(tenantSnapshot.exists() ? tenantSnapshot.data() : {}),
					...(userSnapshot.exists() ? userSnapshot.data() : {}),
				};

				if (!userSnapshot.exists() && !tenantSnapshot.exists()) {
					if (active) setError("Tenant profile could not be found.");
					return;
				}

				const propertyId = profile.propertyId || profile.assignedPropertyId;
				let propertyName = profile.propertyName || "Not assigned";
				if (propertyId) {
					const propertySnapshot = await getDoc(doc(db, "properties", propertyId));
					if (propertySnapshot.exists()) {
						const property = propertySnapshot.data();
						propertyName = property.propertyName || property.name || propertyName;
					}
				}

				if (active) {
					setTenantInfo({
						...profile,
						propertyName,
						roomNumber: profile.roomNumber || profile.roomId || profile.room || "Not assigned",
						monthlyRent: profile.monthlyRent || profile.rent || 0,
					});
				}
			} catch (loadError) {
				console.error("Failed to load tenant profile:", loadError);
				if (active) setError("Unable to load your tenant information.");
			} finally {
				if (active) setLoading(false);
			}
		};

		loadTenantProfile();
		unsubscribeTickets = onSnapshot(
			query(collection(db, "maintenance_tickets"), where("tenantUid", "==", user.uid)),
			(snapshot) => {
				if (active) setTickets(snapshot.docs.map((ticket) => ({ id: ticket.id, ...ticket.data() })));
			},
			(loadError) => {
				console.error("Failed to load tenant tickets:", loadError);
				if (active) setError("Unable to load your repair requests.");
			}
		);
		unsubscribePayments = onSnapshot(
			query(collection(db, "payments"), where("tenantUid", "==", user.uid)),
			(snapshot) => {
				if (active) setPayments(snapshot.docs.map((payment) => ({ id: payment.id, ...payment.data() })));
			},
			(loadError) => {
				console.error("Failed to load tenant payment history:", loadError);
				if (active) setError("Unable to load your payment history.");
			}
		);

		return () => {
			active = false;
			unsubscribeTickets?.();
			unsubscribePayments?.();
		};
	}, [navigate]);

	if (loading) {
		return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
	}

	if (section === "payments") {
		return (
			<Box>
				{error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}
				<Typography variant="h5" fontWeight="700" sx={{ mb: 3 }}>Payments</Typography>
				<Card variant="outlined" sx={{ maxWidth: 420, mb: 3, borderRadius: 2 }}>
					<CardContent>
						<Typography variant="body2" color="text.secondary">Monthly Rent</Typography>
						<Typography variant="h4" fontWeight="800" sx={{ mt: 1 }}>
							₱{(Number(tenantInfo.monthlyRent) || 0).toLocaleString()}
						</Typography>
					</CardContent>
				</Card>
				<Typography variant="h6" fontWeight="700" sx={{ mb: 1.5 }}>Payment History</Typography>
				{payments.length === 0 ? (
					<Alert severity="info">No payment records are available yet.</Alert>
				) : (
					<TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
						<Table>
							<TableHead sx={{ bgcolor: "#F5F5F5" }}>
								<TableRow>
									<TableCell><strong>Date</strong></TableCell>
									<TableCell><strong>Description</strong></TableCell>
									<TableCell align="right"><strong>Amount</strong></TableCell>
									<TableCell><strong>Status</strong></TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{payments.map((payment) => (
									<TableRow key={payment.id}>
										<TableCell>{formatDate(payment.paidAt || payment.paymentDate || payment.createdAt)}</TableCell>
										<TableCell>{payment.description || payment.month || "Rent payment"}</TableCell>
										<TableCell align="right">₱{(Number(payment.amount ?? payment.amountPaid ?? payment.rentAmount) || 0).toLocaleString()}</TableCell>
										<TableCell><Chip size="small" label={payment.status || "Recorded"} /></TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</Box>
		);
	}

	return (
		<Box>
			{error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}
			<Typography variant="h5" fontWeight="700" sx={{ mb: 3 }}>
				Overview
			</Typography>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
						gap: 3,
				}}
			>
				{SUMMARY_ITEMS.map((item) => {
					const rawValue = tenantInfo[item.key] ?? item.fallback;
					const value = item.currency
						? `₱${(Number(rawValue) || 0).toLocaleString()}`
						: rawValue;
					return (
						<Card key={item.key} elevation={0} sx={{ border: "1px solid #E0E0E0", borderRadius: 2 }}>
							<CardContent sx={{ p: 2.5 }}>
								<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
									<Typography variant="body2" color="text.secondary" fontWeight="600">
										{item.label}
									</Typography>
									<Box sx={{ color: "#FF6B35" }}>{item.icon}</Box>
								</Box>
								<Typography variant="h6" fontWeight="700">
									{value}
								</Typography>
							</CardContent>
						</Card>
					);
				})}
				<Card elevation={0} sx={{ border: "1px solid #E0E0E0", borderRadius: 2 }}>
					<CardContent sx={{ p: 2.5 }}>
						<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
							<Typography variant="body2" color="text.secondary" fontWeight="600">
								Open Repairs
							</Typography>
							<Box sx={{ color: "#D97706" }}><BuildOutlinedIcon /></Box>
						</Box>
						<Typography variant="h6" fontWeight="700">
							{tickets.filter((ticket) => String(ticket.status || "Pending").toLowerCase() !== "resolved").length}
						</Typography>
					</CardContent>
				</Card>
			</Box>
			<Paper elevation={0} sx={{ mt: 3, p: 3, border: "1px solid #E0E0E0", borderRadius: 2 }}>
				<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 2 }}>
					<Typography variant="h6" fontWeight="700">Maintenance Report</Typography>
					<Button size="small" onClick={() => navigate("/tenant/maintenance")}>View report</Button>
				</Box>
				{tickets.length ? (
					<Stack spacing={1.5}>
						{tickets.slice(0, 3).map((ticket) => (
							<Box key={ticket.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, p: 1.5, bgcolor: "#FAFAFA", borderRadius: 1 }}>
								<Box>
									<Typography variant="subtitle2" fontWeight="700">{ticket.title || "Maintenance request"}</Typography>
									<Typography variant="caption" color="text.secondary">Room {ticket.roomNumber || tenantInfo.roomNumber || "—"} · {formatDate(ticket.createdAt)}</Typography>
								</Box>
								<Chip size="small" label={ticket.status || "Pending"} color={String(ticket.status || "Pending").toLowerCase() === "resolved" ? "success" : "warning"} />
							</Box>
						))}
					</Stack>
				) : <Typography variant="body2" color="text.secondary">No maintenance reports yet.</Typography>}
			</Paper>

			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 3 }}>
				<Typography variant="body2" color="text.secondary">Account status</Typography>
				<Chip
					label={tenantInfo.status || "Active"}
					color={tenantInfo.status === "Inactive" ? "default" : "success"}
					size="small"
				/>
			</Box>
		</Box>
	);
}
